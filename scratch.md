{
"permissions": {
"allow": [],
"deny": []
},
"hooks": {
"Stop": [
{
"matcher": "",
"hooks": [
{
"type": "command",
"command": "terminal-notifier -title \"✅ Claude Code\" -message \"The task has
been completed\""
}
]
}
],
"Notification": [
{
"matcher": "",
"hooks": [
{
"type": "command",
"command": "terminal-notifier -title \"🔔 Claude Code\" -message \"Claude needs
your input\""
}
]
}
],
"SubagentStop": [
{
"matcher": "",
"hooks": [
{
"type": "command",
"command": "afplay /System/Library/Sounds/Ping.aiff 2>/dev/null || echo -e
'\\n\\033[1;34m✓ Task completed by Claude Code\\033[0m\\n'"
}
]
}
]
},
"feedbackSurveyState": {
"lastShownTime": 1754131386851
},
"alwaysThinkingEnabled": true
}
