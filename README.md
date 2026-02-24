# Antigravity Auto Run Pro

Welcome to the ultimate solution for hands-free automation in your IDE! **Antigravity Auto Run Pro** acts as an **auto pilot**, serving as your **free auto accept agent**. It automatically fires the **auto run command** and utilizes **auto accept** logic for all Antigravity agent steps without limits, allowing you to streamline your development workflow and focus purely on the results.

This is the premium rebuilt version designed specifically to work seamlessly with zero conflicts starting from IDE version 1.18.4+. If you are tired of clicking "Accept" or "Run" repeatedly, our advanced **auto pilot** is exactly what you need.

[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=for-the-badge&logo=github)](https://github.com/sponsors/MarcoDeliaBot)

## Why Antigravity Auto Run Pro?

Finding the right automation tool is crucial. **Antigravity Auto Run Pro** was built with performance, security, and reliability in mind. It integrates directly with the IDE's core command system to intelligently auto-accept prompts, ensuring your AI coding sessions remain uninterrupted.

## Key Features

- **Seamless Background Auto-Accept**: Never manually click to approve AI actions again.
- **Terminal Commands Execution Bypass**: Safely and automatically triggers the correct internal commands (e.g., `antigravity.terminalCommand.run` and `antigravity.terminalCommand.accept`).
- **100% Reliability**: Rock-solid background processes that never miss a prompt.
- **Localized OS Support**: Supports native button prompts across all IDE localizations (English, Italian, etc.).
- **Easy Toggle Switch**: Activate or deactivate **Antigravity Auto Run Pro** on-the-fly using the bottom-right status bar icon, or the `Ctrl+Alt+Shift+R` (`Cmd+Alt+Shift+R` on Mac) shortcut.
- **God Mode (Optional)**: When enabled, also auto-accepts parent folder access prompts (`Allow`, `Always Allow`, `Consenti`). **Disabled by default for safety.** Toggle via the `$(flame) GOD` status bar icon or `Ctrl+Alt+Shift+G`.

## God Mode ⚠️

By default, **Antigravity Auto Run Pro** does NOT auto-accept prompts that grant the agent access to files outside your workspace. This is a safety measure — AI agents can sometimes delete or modify files in unexpected locations.

If you want full, unattended automation (including folder access prompts), you can enable **God Mode**:

1. Click the `$(shield) Safe` icon in the status bar, or
2. Use the shortcut `Ctrl+Alt+Shift+G` (`Cmd+Alt+Shift+G` on Mac), or
3. Run `Toggle God Mode (Auto Run Pro)` from the Command Palette, or
4. Set `autorunpro.godMode` to `true` in VS Code Settings.

> ⚠️ **Warning**: Enabling God Mode lets the agent access files outside your workspace without asking for confirmation. Use at your own risk.

## Usage

Simply install **Antigravity Auto Run Pro** and enjoy a completely hands-free AI coding experience. The extension starts working automatically upon launch. You can freely toggle the extension On/Off directly from the Status Bar at the bottom right whenever you need manual control over agent steps.

## Troubleshooting

If you have just installed **Antigravity Auto Run Pro** and it does not seem to appear in searches locally, please give the marketplace up to 45 minutes to refresh its index. Once installed, it runs silently to supercharge your workflow.

## License

MIT License. Crafted with passion to power up your development speed.
