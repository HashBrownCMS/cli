'use strict';

const FileSystem = require('fs');
const Path = require('path');
const Util = require('util');

/**
 * A helper class for handling file system operations
 *
 * @memberof HashBrown.Server.Helpers
 */
class FileHelper {
    /**
     * Makes a directory (recursively) if it doesn't exist
     *
     * @param {String} path
     * @param {Number} position
     *
     * @return {Promise} Result
     */
    static makeDirectory(path, position = 0) {
        let parts = Path.normalize(path).split(Path.sep);
        
        if(position >= parts.length) {   
            return Promise.resolve();
        }
        
        let currentDirPath = parts.slice(0, position + 1).join(Path.sep);
        
        return new Promise((resolve, reject) => {
            if(!currentDirPath || FileSystem.existsSync(currentDirPath)) { return resolve(); }
       
            FileSystem.mkdir(currentDirPath, (err) => {
                if(err) { return reject(err); }

                resolve();
            });
        })
        .then(() => {
            return this.makeDirectory(path, position + 1);
        });
    }

    /**
     * Checks if a file or folder exists
     *
     * @param {String} path
     *
     * @return {Promise} Whether or not the file/folder exists
     */
    static async exists(path) {
        return FileSystem.existsSync(path);
    }

    /**
     * Lists a file or files in a folder
     *
     * @param {String} path
     *
     * @return {Promise} Array of file paths
     */
    static list(path) {
        return new Promise((resolve, reject) => {
            FileSystem.lstat(path, (err, stats) => {
                if(err) { return reject(err); }

                if(stats.isDirectory()) {
                    FileSystem.readdir(path, (err, files) => {
                        if(err) { return reject(err); }

                        resolve(files);
                    });
                } else if(stats.isFile()) {
                    resolve([ path ]);
                } else {
                    reject(new Error('File type for ' + path + ' unknown'));
                }
            });
        });
    }

    /**
     * Reads a file or files in a folder
     *
     * @param {String} path
     * @param {String} encoding
     *
     * @return {Promise} Buffer or array of buffers
     */
    static read(path, encoding) {
        return this.list(path)
        .then((files) => {
            let buffers = [];

            let readNext = () => {
                let file = files.pop();

                if(!file) { return Promise.resolve(buffers); }

                return new Promise((resolve, reject) => {
                    FileSystem.readFile(file, (err, buffer) => {
                        if(err) { return reject(err); }

                        resolve(buffer);
                    });
                })
                .then((buffer) => {
                    if(encoding) {
                        buffer = buffer.toString(encoding);
                    }

                    buffers.push(buffer);

                    return readNext();
                });
            };
       
            return readNext();
        })
        .then((buffers) => {
            if(!buffers) { return Promise.resolve(null); }

            if(buffers.length === 1) {
                return Promise.resolve(buffers[0]);
            }

            return Promise.resolve(buffers);
        });
    }

    /**
     * Removes a file or folder
     *
     * @param {String} path
     *
     * @return {Promise} Result
     */
    static async remove(path) {
        if(FileSystem.lstatSync(path).isDirectory()) {
            for(let filename of await Util.promisify(FileSystem.readdir)(path)) {
                await this.remove(Path.join(path, filename));
            }
        
            await Util.promisify(FileSystem.rmdir)(path);

        } else {
            await Util.promisify(FileSystem.unlink)(path);

        }
    }

    /**
     * Writes a file
     *
     * @param {String|Object} content
     * @param {String} path
     *
     * @return {Promise} Result
     */
    static write(content, path) {
        if(!content) { return Promise.resolve(); }

        return new Promise((resolve, reject) => {
            if(typeof content === 'object') {
                content = JSON.stringify(content, null, 4);
            }

            FileSystem.writeFile(path, content, (err) => {
                if(err) { return reject(err); }

                resolve();
            });
        });
    }

    /**
     * Moves a file
     *
     * @param {String} from
     * @param {String} to
     *
     * @return {Promise} Result
     */
    static move(from, to) {
        return new Promise((resolve, reject) => {
            FileSystem.rename(from, to, (err) => {
                if(err) { return reject(err); }

                resolve();
            });
        });
    }

    /**
     * Copies a file
     *
     * @param {String} from
     * @param {String} to
     *
     * @return {Promise} Result
     */
    static copy(from, to) {
        return new Promise((resolve, reject) => {
            FileSystem.copyFile(from, to, (err) => {
                if(err) { return reject(err); }

                resolve();
            });
        });
    }
}

module.exports = FileHelper;
