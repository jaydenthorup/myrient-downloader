import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { DOWNLOAD_DIRECTORY_STRUCTURE } from '../constants.js';

/**
 * Service responsible for file system interactions, particularly for managing download directories.
 */
class FileSystemService {
  /**
   * Calculates the target and extraction paths for a file based on download options.
   * @param {string} baseDir The base download directory.
   * @param {object} fileInfo Information about the file, including name and href.
   * @param {object} options Download options.
   * @param {boolean} options.createSubfolder Whether to create a subfolder.
   * @param {boolean} options.maintainFolderStructure Whether to maintain the remote folder structure.
   * @param {string} options.baseUrl The base URL of the download.
   * @returns {{targetPath: string, extractPath: string}}
   */
  static calculatePaths(baseDir, fileInfo, { createSubfolder, maintainFolderStructure, baseUrl }) {
    const filename = fileInfo.name;
    let finalTargetDir = baseDir;

    if (createSubfolder) {
      finalTargetDir = path.join(baseDir, path.parse(filename).name);
    }

    let targetPath;
    if (maintainFolderStructure && fileInfo.href) {
      let relativePath = fileInfo.href;
      try {
        const hrefUrl = new URL(fileInfo.href);
        const baseUrlObj = new URL(baseUrl);
        let hrefPath = hrefUrl.pathname;
        let basePath = baseUrlObj.pathname;
        basePath = basePath.replace(/\/$/, '');
        const basePathSegments = basePath.split('/').filter(s => s.length > 0);
        const selectedDirectory = basePathSegments[basePathSegments.length - 1];
        const parentPath = basePath.substring(0, basePath.lastIndexOf('/' + selectedDirectory));

        if (parentPath && hrefPath.startsWith(parentPath + '/')) {
          relativePath = hrefPath.substring(parentPath.length + 1);
        } else if (hrefPath.startsWith(basePath + '/')) {
          relativePath = selectedDirectory + '/' + hrefPath.substring(basePath.length + 1);
        } else {
          relativePath = filename;
        }
        relativePath = decodeURIComponent(relativePath);
      } catch (e) {
        if (relativePath.startsWith(baseUrl)) {
          relativePath = relativePath.substring(baseUrl.length);
        }
        relativePath = relativePath.replace(/^\/+/, '');
      }

      const hrefDirPath = path.dirname(relativePath);
      if (hrefDirPath && hrefDirPath !== '.' && hrefDirPath !== '/') {
        const normalizedDirPath = hrefDirPath.replace(/\//g, path.sep);
        const fullDirPath = path.join(finalTargetDir, normalizedDirPath);
        targetPath = path.join(fullDirPath, filename);
      } else {
        targetPath = path.join(finalTargetDir, filename);
      }
    } else {
      targetPath = path.join(finalTargetDir, filename);
    }

    let extractPath;
    if (maintainFolderStructure) {
      extractPath = path.dirname(targetPath);
    } else if (createSubfolder) {
      extractPath = path.join(baseDir, path.parse(filename).name);
    } else {
      extractPath = baseDir;
    }

    return { targetPath, extractPath };
  }

  /**
   * Checks if an archive's contents already exist in the extraction path.
   * @param {string} extractionPath The directory where files would be extracted.
   * @param {string} archiveFilename The name of the archive file.
   * @returns {Promise<boolean>} True if the content appears to be extracted.
   */
  static async isAlreadyExtracted(extractionPath, archiveFilename) {
    try {
      if (fs.existsSync(extractionPath) && fs.lstatSync(extractionPath).isDirectory()) {
        const filesInDir = await fs.promises.readdir(extractionPath);
        if (filesInDir.length > 0 && filesInDir.some(f => f.toLowerCase() !== archiveFilename.toLowerCase())) {
          return true;
        }
      }
    } catch (e) {
    }
    return false;
  }

  /**
   * Checks the structure of a given download directory.
   * @param {string} downloadPath The absolute path to the download directory.
   * @returns {Promise<DownloadDirectoryStructure>} A promise that resolves with the detected directory structure.
   * @throws {Error} If an error occurs during file system access, other than the directory not existing.
   */
  async checkDownloadDirectoryStructure(downloadPath) {
    try {
      const entries = await fs.promises.readdir(downloadPath, { withFileTypes: true });

      let hasFiles = false;
      let hasDirectories = false;

      for (const entry of entries) {
        if (entry.isFile()) {
          hasFiles = true;
        } else if (entry.isDirectory()) {
          hasDirectories = true;
        }
      }

      if (!hasFiles && !hasDirectories) {
        return DOWNLOAD_DIRECTORY_STRUCTURE.EMPTY;
      } else if (hasFiles && !hasDirectories) {
        return DOWNLOAD_DIRECTORY_STRUCTURE.FLAT;
      } else if (!hasFiles && hasDirectories) {
        return DOWNLOAD_DIRECTORY_STRUCTURE.SUBFOLDERS;
      } else {
        return DOWNLOAD_DIRECTORY_STRUCTURE.MIXED;
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        return DOWNLOAD_DIRECTORY_STRUCTURE.EMPTY;
      }
      throw e;
    }
  }
}

export default FileSystemService;
