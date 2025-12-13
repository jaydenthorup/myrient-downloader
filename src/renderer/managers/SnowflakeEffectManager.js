class SnowflakeEffectManager {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.snowflakes = [];
    this.animationFrameId = null;
    this.running = false;
    this.maxSnowflakes = 100; // Control the total number of snowflakes
    this.headerHeight = 0;
    this.footerHeight = 0;
    this.lastSnowflakeAddTime = 0; // Timestamp of when the last snowflake was added
    this.newSnowflakeInterval = 100; // Milliseconds between adding new snowflakes
    this.fadingOut = false;
    this.fadeSpeed = 0.02;
  }

  init(containerElement, headerHeight, footerHeight) {
    this.headerHeight = headerHeight;
    this.footerHeight = footerHeight;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'snowflake-canvas';
    this.canvas.classList.add('fixed', 'top-0', 'left-0', 'pointer-events-none', 'z-10'); // Add Tailwind classes
    containerElement.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  resizeCanvas() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      // Snowflakes will automatically scale and reposition due to vh/vw based properties
      // Force a redraw to update positions immediately
      if (this.running) { // Only draw if animation is active
        this.drawSnowflakes();
      }
    }
  }

  start() {
    if (this.running) return;

    // If a fade-out is in progress, cancel it and restart immediately
    if (this.fadingOut) {
      this.fadingOut = false; // Cancel ongoing fade out
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId); // Stop old animation loop
      }
      this.snowflakes = []; // Clear existing (fading) snowflakes
      if (this.ctx) { // Ensure context exists before clearing
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear canvas
      }
      this.animationFrameId = null; // Clear animation frame ID
    }

    this.running = true;
    this.lastSnowflakeAddTime = performance.now(); // Initialize timestamp
    this.generateSnowflakes(this.maxSnowflakes); // Start with the maximum number of snowflakes
    this.animate(this.lastSnowflakeAddTime); // Pass initial timestamp to animate
  }

  stop() {
    this.running = false;
    this.fadingOut = true; // Start fade out process
    // The animate loop will handle fading and cleanup
  }

  generateSnowflakes(count) {
    for (let i = 0; i < count; i++) {
      this.snowflakes.push(this.createSnowflake());
    }
  }

  createSnowflake() {
    // Store x as % of viewport width (vw), y as % of viewport height (vh)
    const xVw = Math.random() * 100;

    // Define a spawn zone: from -2vh (just above the very top of the canvas) to -10vh
    const yVh = Math.random() * -8 - 2; // Roughly between -2vh and -10vh

    // Store radius, speed, sway as values relative to 1vh, so they scale with viewport height
    const radiusVh = Math.random() * 0.2 + 0.15;
    const speedVh = Math.random() * 0.05 + 0.02;
    const swayVh = Math.random() * 0.05 - 0.025;

    const opacity = Math.random() * 0.5 + 0.5; // 0.5 to 1
    const swayOffset = Math.random() * Math.PI * 2; // Starting point in sine wave

    return { xVw, yVh, radiusVh, speedVh, opacity, swayVh, swayOffset };
  }

  updateSnowflakes() {
    const currentViewPortHeight = window.innerHeight;
    const currentViewPortWidth = window.innerWidth;

    this.snowflakes.forEach(snowflake => {
      // Update Y position in vh
      snowflake.yVh += snowflake.speedVh;

      // Update X position for sway effect, ensuring sway scales with viewport height
      const swayAmountVw = (Math.sin(snowflake.swayOffset + snowflake.yVh * 0.1) * snowflake.swayVh * (currentViewPortHeight / currentViewPortWidth));
      snowflake.xVw += swayAmountVw;

      // If snowflake goes beyond left/right, wrap it (using vw percentages)
      if (snowflake.xVw < 0) {
        snowflake.xVw = 100;
      } else if (snowflake.xVw > 100) {
        snowflake.xVw = 0;
      }

      if (this.fadingOut) {
        snowflake.opacity -= this.fadeSpeed; // Decrease opacity
        if (snowflake.opacity < 0) {
          snowflake.opacity = 0;
        }
      }
    });

    // Filter out fully faded snowflakes OR snowflakes that have left the screen
    this.snowflakes = this.snowflakes.filter(snowflake => {
      const isFaded = snowflake.opacity <= 0;

      // Convert headerHeight and footerHeight to vh for comparison
      const headerHeightVh = (this.headerHeight / currentViewPortHeight) * 100;
      const footerHeightVh = (this.footerHeight / currentViewPortHeight) * 100;

      // Convert snowflake.radiusVh to current vh value
      const radiusVh = snowflake.radiusVh;

      // Check if snowflake.yVh is within the desired vertical bounds (above header and below footer)
      // Snowflake should disappear *behind* the footer, so it can go a bit further down.
      // It should appear *behind* the header, so it starts above.
      const isOffScreen = !(
        snowflake.yVh < (100 - footerHeightVh + radiusVh) && // Check if below bottom threshold (footer height + its own radius to disappear behind)
        snowflake.yVh > -(headerHeightVh + radiusVh) // Check if above top threshold (header height + its own radius to appear from behind)
      );

      return !(isFaded || isOffScreen); // Keep if not faded AND not off-screen
    });
  }

  drawSnowflakes() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const currentViewPortWidth = window.innerWidth;
    const currentViewPortHeight = window.innerHeight;

    this.snowflakes.forEach(snowflake => {
      // Convert vh/vw units to pixels for drawing
      const xPx = (snowflake.xVw / 100) * currentViewPortWidth;
      const yPx = (snowflake.yVh / 100) * currentViewPortHeight;
      const radiusPx = (snowflake.radiusVh / 100) * currentViewPortHeight; // Radius scales with height

      this.ctx.beginPath();
      this.ctx.arc(xPx, yPx, radiusPx, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${snowflake.opacity})`;
      this.ctx.fill();
    });
  }

  animate(currentTime) {
    this.updateSnowflakes();
    this.drawSnowflakes();

    // Only add new snowflakes if not fading out and still running
    if (!this.fadingOut && this.running && this.snowflakes.length < this.maxSnowflakes && currentTime - this.lastSnowflakeAddTime > this.newSnowflakeInterval) {
      this.snowflakes.push(this.createSnowflake());
      this.lastSnowflakeAddTime = currentTime;
    }

    // Check if fade-out is complete
    if (this.fadingOut && this.snowflakes.length === 0) {
      cancelAnimationFrame(this.animationFrameId);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.fadingOut = false; // Reset flag
      this.animationFrameId = null; // Clear animation frame ID
    } else {
      this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    }
  }

  destroy() {
    this.stop();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    window.removeEventListener('resize', this.resizeCanvas.bind(this));
  }
}

export default SnowflakeEffectManager;