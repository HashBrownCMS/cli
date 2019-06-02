#!/usr/bin/env node

'use strict';

const OS = require('os');
const Util = require('util');
const FileSystem = require('fs');
const Path = require('path');
const ChildProcess = require('child_process');
const ReadLine = require('readline');
const URL = require('url');

const FileHelper = require('./FileHelper');
const RequestHelper = require('./RequestHelper');

const MAX_REQUEST_REDIRECTS = 10;
const INDENT = '  ';
const COLUMN_SPACING = '          ';

/**
 * Checks arguments for validity
 */
function checkArgs(args, minAmount, usageString) {
    if(!args || args.length < minAmount) {
        console.log('Usage: hashbrown-cli ' + usageString);
        process.exit()
    }
}

/**
 * Writes data to a config file
 */
async function writeConfig(filename, content) {
    let baseDir = Path.join(OS.homedir(), '.config', 'hashbrown-cli');
 
    await FileHelper.makeDirectory(baseDir);
    await FileHelper.write(content, Path.join(baseDir, filename + '.json'));
}

/**
 * Writes data to a cache file
 */
async function writeCache(filename, content) {
    let baseDir = Path.join(OS.homedir(), '.config', 'hashbrown-cli', 'cache');
 
    await FileHelper.makeDirectory(baseDir);
    await FileHelper.write(content, Path.join(baseDir, filename + '.json'));
    
    return Path.join(baseDir, filename + '.json');
}

/**
 * Reads data from a config file
 */
async function readConfig(filename) {
    let baseDir = Path.join(OS.homedir(), '.config', 'hashbrown-cli');
   
    try {
        let file = await FileHelper.read(Path.join(baseDir, filename + '.json'));

        if(!file || file.length < 1) { return {}; }

        return JSON.parse(file);

    } catch(e) {
        return {};

    }
}

/**
 * Gets the current session
 */
async function getSession(skipLocation = false) {
    let config = await readConfig('session');

    if(!config.host || !config.token) {
        throw new Error('Not logged in. Please use "hashbrown-cli login" first');
    }
    
    if(!skipLocation && (!config.project || !config.environment)) {
        throw new Error('Project and environment not set. Please use "hashbrown-cli use" first');
    }

    return config;
}

/**
 * Prints strings in columns
 */
function columns(items, spacingMultiplier = 1) {
    let row = '';

    let spacing = '';

    for(let i = 0; i < spacingMultiplier; i++) {
        spacing += COLUMN_SPACING;
    }

    for(let i in items) {
        let item = items[i];

        if(item === INDENT) {
            row += INDENT;
        
        } else if(i < items.length - 1) {
            if(item.length > spacing.length) {
                item = item.slice(0, spacing.length - 5) + '...  ';
            }

            row += item;

            if(item.length < spacing.length) {
                row += spacing.slice(0, -item.length);
            }
        
        } else {
            row += item;
        
        }
    }

    console.log(row);
}

/**
 * Makes a resource request
 */
async function resourceRequest(method, category, id, data) {
    let session = await getSession();

    let url = session.host + '/api/' + session.project + '/' + session.environment + '/' + category;

    if(id) {
        url += '/' + id;
    }

    if(url.indexOf('?') > -1) {
        url += '&';
    } else {
        url += '?';
    }

    url += 'token=' + session.token;

    let result = await RequestHelper.request(method, url, data);

    if(typeof result === 'string') {
        console.log(result);
    }

    return result;
}

/**
 * Edits a resource
 */
async function editResource(category, id) {
    let session = await getSession();
    let data = await RequestHelper.request('get', session.host + '/api/' + session.project + '/' + session.environment + '/' + category + '/' + id + '?token=' + session.token);
    let cachePath = await writeCache(id, data);
    let editorName = await readConfig('settings').editor || process.env.EDITOR || 'vi';

    await new Promise((resolve, reject) => {
        let editor = ChildProcess.spawn(editorName, [ cachePath ], {
            stdio: 'inherit'
        });

        editor.on('exit', (e, code) => {
            resolve();
        });
    });

    data = await FileHelper.read(cachePath);
    data = JSON.parse(data.toString('utf8'));

    await RequestHelper.request('post', session.host + '/api/' + session.project + '/' + session.environment + '/' + category + '/' + id + '?token=' + session.token, data);
    
    await FileHelper.remove(cachePath);
}

/**
 * Gets a resource name
 */
function getResourceName(resource) {
    let name = '';

    if(resource.properties) {
        if(typeof resource.properties.title === 'string') {
            name = resource.properties.title;

        } else if(typeof resource.properties.title === 'object') {
            name = Object.values(resource.properties.title).join(' / ');
        }

    } else if(resource.title) {
        name = resource.title;

    } else if(resource.name) {
        name = resource.name;

    }

    if(!name) { name = '(no name)'; }

    return name;
}

/**
 * Handles any resource command
 */
async function resourceCommand(category, args) {
    checkArgs(args, 1, category + ' <command> [<id>]');
    
    let session = await getSession();
   
    switch(args[0]) {
        case 'edit':
            checkArgs(args, 2, category + ' edit <id>');
            
            await editResource(category, args[1]);
            break;

        case 'ls':
            header(session);

            let all = await resourceRequest('get', category);
           
            all = all.sort((a, b) => {
                let aName = getResourceName(a);
                let bName = getResourceName(b);

                if(aName < bName) { return -1; }
                if(bName < aName) { return 1; }

                return 0;
            });

            for(let resource of all) {
                columns([getResourceName(resource), resource.id], 3);
            }

            footer();

            break;
        
        case 'new':
            let verb = 'new';

            if(category === 'content') {
                checkArgs(args, 2, category + ' new <schema>');
            
                verb += '?schemaId=' + args[1];
            } 

            let resource = await resourceRequest('post', category, verb);

            await editResource(category, resource.id);

            break;

        case 'rm':
            checkArgs(args, 2, category + ' rm <id>');
            
            await resourceRequest('delete', category, args[1]);
            
            break;

        default:
            throw new Error('Unknown command "' + args[0] + '"');
    }
}

/**
 * Prints the session header
 */
function header(session, skipLocation) {
    console.log();
    if(!skipLocation && session.project && session.environment) {
        console.log(session.project + ':' + session.environment + '@' + URL.parse(session.host).hostname);
    } else {
        console.log(URL.parse(session.host).hostname);
    }
    console.log('--------------------');
}

/**
 * Prints the session footer
 */
function footer() {
    console.log();
}

class HashBrown {
    /**
     * Shows the help dialogue
     */
    static help() {
        console.log('Usage: hashbrown-cli <command> [<args>]');
        console.log();
        
        console.log('general');
        columns([INDENT, 'get', 'Get a settings value, such as "editor"']);
        columns([INDENT, 'help', 'Display this help dialogue']);
        columns([INDENT, 'login', 'Log in to a HashBrown instance']);
        columns([INDENT, 'set', 'Set a settings value, such as "editor"']);
        columns([INDENT, 'use', 'Switch between projects and environments']);
        console.log();
        
        console.log('connection');
        columns([INDENT, 'edit', 'Edit a connection']);
        columns([INDENT, 'ls', 'List all available connections']);
        columns([INDENT, 'new', 'Create a new connection']);
        columns([INDENT, 'rm', 'Remove a connection']);
        console.log();
        
        console.log('content');
        columns([INDENT, 'edit', 'Edit a content node']);
        columns([INDENT, 'ls', 'List all available content']);
        columns([INDENT, 'new', 'Create a new content node']);
        columns([INDENT, 'rm', 'Remove a content node']);
        console.log();
        
        console.log('form');
        columns([INDENT, 'edit', 'Edit a form']);
        columns([INDENT, 'ls', 'List all available forms']);
        columns([INDENT, 'new', 'Create a new form']);
        columns([INDENT, 'rm', 'Remove a form']);
        console.log();
        
        console.log('schema');
        columns([INDENT, 'edit', 'Edit a schema']);
        columns([INDENT, 'ls', 'List all available schemas']);
        columns([INDENT, 'new', 'Create a new schema']);
        columns([INDENT, 'rm', 'Remove a schema']);
        console.log();

        console.log('project');
        columns([INDENT, 'ls', 'List all projects']);
    }

    /**
     * Logs in the user
     */
    static async login(args) {
        checkArgs(args, 3, 'login <host> <username> <password>');
   
        try {
            let token = await RequestHelper.request('post', args[0] + '/api/user/login?persist=false', { username: args[1], password: args[2] }); 
       
            console.log('Login successful, received token', token);

            let session = await readConfig('session');

            session.host = args[0];
            session.token = token;

            delete session.project;
            delete session.environment;

            await writeConfig('session', session);

        } catch(e) {
            console.log('Login failed: ', e.message);

        }
    }

    /**
     * Handles content operations
     */
    static async content(args) {
        await resourceCommand('content', args);
    }
    
    /**
     * Handles schema operations
     */
    static async schema(args) {
        await resourceCommand('schemas', args);
    }
    
    /**
     * Handles connection operations
     */
    static async connection(args) {
        await resourceCommand('connections', args);
    }
    
    /**
     * Handles form operations
     */
    static async form(args) {
        await resourceCommand('forms', args);
    }

    /**
     * Switches between projects/environments
     */
    static async use(args) {
        checkArgs(args, 2, 'use <project> <environment>');

        let session = await getSession(true);

        session.project = args[0];
        session.environment = args[1];

        await writeConfig('session', session);
    }

    /**
     * Handles project requests
     */
    static async project(args) {
        checkArgs(args, 1, 'project <command> [<id>]');
        
        let session = await getSession(true);

        switch(args[0]) {
            case 'ls':
                header(session, true);

                let all = await RequestHelper.request('get', session.host + '/api/server/projects?token=' + session.token);

                for(let i in all) {
                    let project = all[i];
                    let line = [];

                    if(project.settings && project.settings.info) {
                        line.push(project.settings.info.name);
                    }

                    line.push(project.id);

                    columns(line, 2);

                    if(project.environments) {
                        for(let environment of project.environments) {
                            columns([' ', '- ' + environment], 2);
                        }
                    } else {
                        columns([' ', '- live'], 2);
                    }

                    if(i < all.length - 1) {
                        console.log();
                    }
                }

                footer();

                break;
        }
    }

    /**
     * Sets a setting parameter
     */
    static async set(args) {
        checkArgs(args, 2, 'set <name> <value>');

        let config = await readConfig('settings');

        config[args[0]] = args[1];

        await writeConfig('settings', config);
    }
    
    /**
     * Gets a setting parameter
     */
    static async get(args) {
        checkArgs(args, 1, 'get <name>');

        let config = await readConfig('settings');

        console.log(config[args[0]]);
    }

    /**
     * The main method
     */
    static async main() {
        if(!process.argv || process.argv.length < 3) {
            this.help();
            process.exit(0);

        } else if(typeof this[process.argv[2]] !== 'function') {
            console.log('Unknown function "' + process.argv[2] + '"');
            process.exit(1);

        } else {
            try {
                await this[process.argv[2]](process.argv.slice(3));

                process.exit(0);

            } catch(e) {
                console.log(e.message);

                process.exit(1);
            
            }
        }
    }
}

HashBrown.main();
