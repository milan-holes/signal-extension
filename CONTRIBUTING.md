# Contributing to Signal

Thank you for your interest in contributing to Signal! We welcome contributions from everyone. By participating in this project, you agree to abide by our code of conduct.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/signal-extension.git
    cd signal-extension
    ```
3.  **Create a branch** for your feature or bugfix:
    ```bash
    git checkout -b feature/my-new-feature
    ```

## Development Workflow

### Prerequisites
- Google Chrome (or Chromium-based browser)
- Basic knowledge of HTML, CSS, and Vanilla JavaScript.

### Local Setup
1.  Open Chrome and go to `chrome://extensions`.
2.  Enable **Developer Mode** (top right).
3.  Click **Load unpacked**.
4.  Select the `signal-extension` directory.

### Making Changes
- **Code Style**: We use modern Vanilla JavaScript (ES6+).
- **Styling**: Use CSS Variables defined in `root` (see `viewer.html` or `popup.html`) for consistency, especially for Dark Mode.
- **Icons**: Use SVG icons directly in HTML/JS (mostly 24x24, stroke width 2).

### Testing
- **Reload the extension** in `chrome://extensions` after making changes to the background script or manifest.
- **Refresh the target page** to reinject content scripts.
- Use the **Viewer** (`viewer.html`) to verify report generation.

## Submitting a Pull Request

1.  **Commit your changes** with clear, descriptive messages.
    ```bash
    git commit -m "feat: add new network filter type"
    ```
2.  **Push to your fork**:
    ```bash
    git push origin feature/my-new-feature
    ```
3.  **Open a Pull Request** on the main repository.
    - Fill out the PR template.
    - Attach screenshots if you modified the UI.

## Reporting Bugs

Please use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md) when submitting issues. Include:
- Chrome Version
- OS Version
- Steps to reproduce
- Screenshots or Screen Recordings (you can use Signal itself!)

## License
By contributing, you agree that your contributions will be licensed under the project's [LICENSE](LICENSE).
