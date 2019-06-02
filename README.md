# HashBrown CMS command-line interface

## Install from NPM
`npm i -g hashbrown-cli`

## Example workflow

1. Set your preferred editor
```
$ hashbrown-cli set editor vim
```

2. Log in to a HashBrown instance
```
$ hashbrown-cli login https://hashbrown.myserver.com myuser mypass
```

3. List all projects
```
$ hashbrown-cli project ls

hashbrown.myserver.com
--------------------
site1.com           0aa477d87aeca34e
                    - live
                    - testing

site2.com           febec265e2d80da0
                    - live
                    - testing
```

4. Enter a project and environment
```
$ hashbrown-cli use febec265e2d80da0 live
```

5. List content
```
$ hashbrown-cli content ls

0aa477d87aeca34e:live@hashbrown.myserver.com
--------------------
Page 1                        40251e2b09366633
Page 2                        45f1fdc3451022b4
Page 3                        cb3747b2a3272c90
Page 4                        0a7724a8bed9c624
```

6. Edit content using partial id
```
$ hashbrown-cli content edit 0a7
```

7. Create new content
```
$ hashbrown-cli content new
```

## Usage
```
Usage: hashbrown-cli <command> [<args>]

general
  get       Get a settings value, such as "editor"
  help      Display this help dialogue
  login     Log in to a HashBrown instance
  set       Set a settings value, such as "editor"
  use       Switch between projects and environments

connection
  edit      Edit a connection
  ls        List all available connections
  new       Create a new connection
  rm        Remove a connection

content
  edit      Edit a content node
  ls        List all available content
  new       Create a new content node
  rm        Remove a content node

form
  edit      Edit a form
  ls        List all available forms
  new       Create a new form
  rm        Remove a form

schema
  edit      Edit a schema
  ls        List all available schemas
  new       Create a new schema
  rm        Remove a schema

project
  ls        List all projects
```
