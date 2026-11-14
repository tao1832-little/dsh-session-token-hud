# GitHub Release Guide for dsh-session-token-hud

## Publishing to npm (after publishing to GitHub)

Once the plugin is published to GitHub, you can publish it to npm:

1. Go to Settings → Plugins in DeepSeek Harness Web
2. Click "Add Plugin" and search for `dsh-session-token-hud`
3. Or use the npm command after publishing to npm registry

## Installing from GitHub

### Direct Git URL Installation

You can install directly from the GitHub repository:

```text
https://github.com/tao1832-little/dsh-session-token-hud
```

Or from a specific tag/release:

```text
https://github.com/tao1832-little/dsh-session-token-hud/releases/download/v1.0.0/dsh-session-token-hud-1.0.0.tgz
```

### Using plugin_manager

You can let the Harness agent install it for you:

```powershell
plugin_manager install C:\Users\you\plugins\dsh-session-token-hud
```

## Version History

- **v1.1.0** (main branch) - Fixed position mode added
- **v1.0.0** (release tag) - Initial release with floating HUD card
