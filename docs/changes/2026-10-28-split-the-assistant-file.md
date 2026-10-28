## 28 October 2026: The AI-assistant code in smaller files

- Behind the scenes only: the code that lets a reader's AI assistant use nine turtles is now four smaller files: one speaks the protocol, one lists the tools, one holds the tools that only read and one the tools that change things. The list of tools is now made once instead of on every call, and a new test checks that every tool an assistant is shown is one nine turtles can actually do. Nothing changes for readers or their assistants.
