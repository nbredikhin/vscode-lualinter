# vscode-lualinter

A simple [Visual Studio Code](https://code.visualstudio.com/) extension to lint Lua scripts with [luac -p](https://www.lua.org/manual/5.1/luac.html).

![Example screenshot](http://i.imgur.com/hm3dSEC.png)

![Example animation](https://thumbs.gfycat.com/CompassionateMadGalago-size_restricted.gif)

## Requirements
1. Ensure that `luac` is installed in your system.
2. Run [`Install Extension`](https://code.visualstudio.com/docs/editor/extension-gallery#_install-an-extension) command from [Command Palette](https://code.visualstudio.com/Docs/editor/codebasics#_command-palette).
3. Search and choose `lualinter`.

## Options
```json
{
    // Enable Lua linter
    "lualinter.enable": true,
    // Show warning message if there is an error when saving a file
    "lualinter.warnOnSave": false
}        
```

**Enjoy!**