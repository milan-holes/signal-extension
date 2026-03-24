# Build Rule
When you finish implementing a new feature, bug fix, or any changes that affect the extension's behavior, ALWAYS run the build process before notifying the user that the task is complete.

1. **Wait for changes to be applied**: Ensure all code changes are saved.
2. **Run the Build**: Use the `run_command` tool to execute `npm run build` in the project root directory.
3. **Wait for completion**: Make sure the build completes successfully before considering the task done.
4. **Notify**: Inform the user that the changes have been built and are ready to test.
