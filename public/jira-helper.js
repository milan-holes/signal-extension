class JiraHelper {
    constructor() {
        this.config = null;
        this.readyPromise = new Promise(resolve => {
            this.loadConfig(resolve);
        });

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.settings) {
                this.loadConfig();
            }
        });
    }

    loadConfig(callback) {
        chrome.storage.local.get(['settings'], (result) => {
            if (result.settings) {
                this.config = {
                    type: result.settings.jiraType || 'server',
                    domain: result.settings.jiraDomain,
                    email: result.settings.jiraEmail,
                    token: result.settings.jiraToken
                };
            }
            if (callback) callback();
        });
    }

    isConfigured() {
        if (!this.config || !this.config.domain || !this.config.token) return false;
        if (this.config.type !== 'server' && !this.config.email) return false;
        return true;
    }

    getAuthHeader() {
        if (this.config.type === 'server') {
            return 'Bearer ' + this.config.token;
        }
        return 'Basic ' + btoa(this.config.email + ':' + this.config.token);
    }

    getApiPrefix() {
        return (this.config.type === 'server') ? '/rest/api/2' : '/rest/api/3';
    }

    getBaseUrl() {
        let domain = this.config.domain;
        if (!domain.startsWith('http')) {
            domain = 'https://' + domain;
        }
        // Remove trailing slash
        if (domain.endsWith('/')) domain = domain.slice(0, -1);
        return domain;
    }

    async getProjects() {
        const isCloud = this.config.type === 'cloud';

        if (isCloud) {
            // Fetch Spaces for Cloud (Confluence)
            const spaceUrl = `${this.getBaseUrl()}/wiki/api/v2/spaces`;
            const response = await fetch(spaceUrl, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                const txt = await response.text();
                throw new Error(`Failed to fetch spaces: ${response.status} ${txt}`);
            }
            const data = await response.json();
            return data.results || data;
        }

        const url = `${this.getBaseUrl()}${this.getApiPrefix()}/project`;
        const response = await fetch(url, {
            headers: {
                'Authorization': this.getAuthHeader(),
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to fetch projects');
        return await response.json();
    }

    async getComponents(projectKeyOrId) {
        const url = `${this.getBaseUrl()}${this.getApiPrefix()}/project/${projectKeyOrId}/components`;
        const response = await fetch(url, {
            headers: {
                'Authorization': this.getAuthHeader(),
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to fetch components');
        return await response.json();
    }

    async createIssue(issueData) {
        const url = `${this.getBaseUrl()}${this.getApiPrefix()}/issue`;
        const isServer = this.config.type === 'server';

        let descriptionField = issueData.description || "";

        if (!isServer) {
            // Cloud uses ADF
            descriptionField = {
                type: "doc",
                version: 1,
                content: [
                    {
                        type: "paragraph",
                        content: [
                            {
                                type: "text",
                                text: issueData.description || "No description."
                            }
                        ]
                    }
                ]
            };
        }

        const body = {
            fields: {
                project: {
                    key: issueData.projectKey
                },
                summary: issueData.summary,
                description: descriptionField,
                issuetype: {
                    name: issueData.issueType || "Bug"
                },
                labels: issueData.labels || []
            }
        };

        if (issueData.componentId) {
            body.fields.components = [{ id: issueData.componentId }];
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error('Failed to create issue: ' + err);
        }
        return await response.json();
    }

    async addAttachment(issueIdOrKey, blob, filename) {
        const url = `${this.getBaseUrl()}${this.getApiPrefix()}/issue/${issueIdOrKey}/attachments`;

        const formData = new FormData();
        formData.append('file', blob, filename);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': this.getAuthHeader(),
                'Accept': 'application/json',
                'X-Atlassian-Token': 'no-check'
            },
            body: formData
        });

        if (!response.ok) throw new Error('Failed to upload attachment');
        return await response.json();
    }

    async loadComponents(projectKey, componentSelect, preferredComponentId = null) {
        componentSelect.innerHTML = '<option value="">None</option>';
        if (!projectKey) return;

        try {
            const components = await this.getComponents(projectKey);
            components.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                componentSelect.appendChild(opt);
            });

            if (preferredComponentId) {
                // Check if option exists
                const exists = Array.from(componentSelect.options).some(o => o.value == preferredComponentId);
                if (exists) {
                    componentSelect.value = preferredComponentId;
                }
            }
        } catch (e) {
            console.error("Failed to load components", e);
        }
    }

    showModal(attachmentBlob, attachmentName) {
        console.log("JiraHelper: showModal called with", attachmentName);
        if (!this.isConfigured()) {
            console.warn("JiraHelper: Not configured");
            alert("Please configure JIRA settings in the extension popup first.");
            return;
        }

        // Identify if modal already exists
        if (document.getElementById('jira-modal')) {
            console.log("JiraHelper: Modal already exists");
            return;
        }

        const isCloud = (this.config.type === 'cloud');
        const projectLabel = isCloud ? "Space" : "Project";
        const componentDisplay = isCloud ? "none" : "block";

        // Create Modal UI
        const modal = document.createElement('div');
        modal.id = 'jira-modal';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; display:flex; justify-content:center; align-items:center;";

        modal.innerHTML = `
        <div style="background:white; padding:20px; border-radius:8px; width:500px; max-width:90%; position:relative;">
            <h2 style="margin-top:0;">Create JIRA Ticket</h2>
            <button id="jira-close-btn" style="position:absolute; top:15px; right:15px; border:none; background:none; cursor:pointer; font-size:18px;">&times;</button>
            
            <div id="jira-loading">Loading ${projectLabel.toLowerCase()}s...</div>
            
            <form id="jira-form" style="display:none; display:flex; flex-direction:column; gap:10px;">
                <div>
                    <label style="display:block; font-weight:bold; margin-bottom:5px;">${projectLabel}</label>
                    <select id="jira-project" style="width:100%; padding:5px;"></select>
                </div>

                <div style="display:${componentDisplay}">
                    <label style="display:block; font-weight:bold; margin-bottom:5px;">Component</label>
                    <select id="jira-component" style="width:100%; padding:5px;"><option value="">None</option></select>
                </div>

                <div>
                    <label style="display:block; font-weight:bold; margin-bottom:5px;">Issue Type</label>
                    <select id="jira-issue-type" style="width:100%; padding:5px;">
                       <option value="Bug" selected>Bug</option>
                       <option value="Task">Task</option>
                       <option value="Story">Story</option>
                       <option value="Improvement">Improvement</option>
                       <option value="New Feature">New Feature</option>
                    </select>
                </div>
                
                <div>
                    <label style="display:block; font-weight:bold; margin-bottom:5px;">Summary</label>
                    <input type="text" id="jira-summary" style="width:100%; padding:5px; box-sizing:border-box;" value="Bug Report: ">
                </div>

                <div>
                    <label style="display:block; font-weight:bold; margin-bottom:5px;">Labels (comma separated)</label>
                    <input type="text" id="jira-labels" style="width:100%; padding:5px; box-sizing:border-box;">
                </div>

                <div>
                    <label style="display:block; font-weight:bold; margin-bottom:5px;">Description</label>
                    <div id="jira-desc-toolbar" style="border:1px solid #ccc; border-bottom:none; padding:5px; background:#f9f9f9; display:flex; gap:5px;">
                         <button type="button" data-cmd="bold" style="min-width:24px; cursor:pointer;"><b>B</b></button>
                         <button type="button" data-cmd="italic" style="min-width:24px; cursor:pointer;"><i>I</i></button>
                         <button type="button" data-cmd="underline" style="min-width:24px; cursor:pointer;"><u>U</u></button>
                    </div>
                    <div id="jira-description" contenteditable="true" style="border:1px solid #ccc; height:100px; padding:5px; overflow-y:auto; background:white;">
                        Steps to reproduce:<br>1. <br>
                    </div>
                </div>
                
                <div style="margin-top:10px;">
                    <div style="font-size:12px; color:#666;">Attaching: ${attachmentName}</div>
                </div>

                <div id="jira-error" style="color:red; margin-top:5px;"></div>

                <div style="margin-top:15px; text-align:right;">
                    <button type="button" id="jira-cancel-btn" style="padding:8px 16px; margin-right:10px;">Cancel</button>
                    <button type="submit" style="padding:8px 16px; background:#0052cc; color:white; border:none; border-radius:4px; cursor:pointer;">Create Ticket</button>
                </div>
            </form>
        </div>
    `;

        document.body.appendChild(modal);

        // Attach toolbar listeners
        const toolbar = document.getElementById('jira-desc-toolbar');
        toolbar.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                document.execCommand(btn.dataset.cmd, false, null);
            });
        });

        const close = () => document.body.removeChild(modal);
        document.getElementById('jira-close-btn').onclick = close;
        document.getElementById('jira-cancel-btn').onclick = close;

        const projectSelect = document.getElementById('jira-project');
        const componentSelect = document.getElementById('jira-component');

        // Load Last Selection
        chrome.storage.local.get(['lastJiraProject', 'lastJiraComponent', 'lastJiraIssueType'], (result) => {
            const lastP = result.lastJiraProject;
            const lastC = result.lastJiraComponent;
            const lastT = result.lastJiraIssueType;

            // Load Projects
            this.getProjects().then(projects => {
                projects.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.key;
                    opt.textContent = `${p.name} (${p.key})`;
                    projectSelect.appendChild(opt);
                });

                if (lastP) {
                    // Verify if key exists in projects
                    if (projects.some(p => p.key === lastP)) {
                        projectSelect.value = lastP;
                    }
                }

                if (lastT) {
                    const typeSelect = document.getElementById('jira-issue-type');
                    if (typeSelect) typeSelect.value = lastT;
                }

                document.getElementById('jira-loading').style.display = 'none';
                document.getElementById('jira-form').style.display = 'flex';

                // Load components for current project, with preference
                this.loadComponents(projectSelect.value, componentSelect, lastC);

                // Setup listener for future changes
                projectSelect.addEventListener('change', () => {
                    this.loadComponents(projectSelect.value, componentSelect);
                });

            }).catch(err => {
                document.getElementById('jira-loading').textContent = "Error: " + err.message;
            });
        });

        document.getElementById('jira-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = "Creating...";
            const errorDiv = document.getElementById('jira-error');
            errorDiv.textContent = "";

            const summary = document.getElementById('jira-summary').value;
            const description = document.getElementById('jira-description').innerText;

            const labels = document.getElementById('jira-labels').value.split(',').map(l => l.trim()).filter(l => l);
            const projectKey = projectSelect.value;
            const componentId = componentSelect.value;
            const issueType = document.getElementById('jira-issue-type').value;

            // Save selection
            chrome.storage.local.set({
                lastJiraProject: projectKey,
                lastJiraComponent: componentId,
                lastJiraIssueType: issueType
            });

            try {
                const issue = await this.createIssue({
                    projectKey,
                    componentId,
                    issueType,
                    summary,
                    description: description,
                    labels,
                    componentId
                });

                btn.textContent = "Uploading Attachment...";

                await this.addAttachment(issue.key, attachmentBlob, attachmentName);

                alert(`Ticket Created: ${issue.key}`);
                close();
            } catch (err) {
                btn.disabled = false;
                btn.textContent = "Create Ticket";
                errorDiv.textContent = err.message;
            }
        });
    }
}

window.jiraHelper = new JiraHelper();
