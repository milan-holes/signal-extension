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

    async getIssueTypes(projectKey) {
        // Try createmeta endpoint first (works on both Server and Cloud)
        try {
            const url = `${this.getBaseUrl()}${this.getApiPrefix()}/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.projects && data.projects.length > 0 && data.projects[0].issuetypes) {
                    return data.projects[0].issuetypes.map(it => ({ id: it.id, name: it.name, subtask: it.subtask || false }));
                }
            }
        } catch (e) {
            console.warn('createmeta failed, trying fallback', e);
        }

        // Fallback: generic issue types endpoint
        const url = `${this.getBaseUrl()}${this.getApiPrefix()}/issuetype`;
        const response = await fetch(url, {
            headers: {
                'Authorization': this.getAuthHeader(),
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to fetch issue types');
        const types = await response.json();
        return (types.issueTypes || types).map(it => ({ id: it.id, name: it.name, subtask: it.subtask || false }));
    }

    async loadIssueTypes(projectKey, issueTypeSelect, preferredType = null) {
        issueTypeSelect.innerHTML = '';
        if (!projectKey) return;

        try {
            const types = await this.getIssueTypes(projectKey);
            // Filter out sub-tasks by default
            const filtered = types.filter(t => !t.subtask);
            filtered.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.name;
                opt.textContent = t.name;
                issueTypeSelect.appendChild(opt);
            });

            if (preferredType) {
                const exists = Array.from(issueTypeSelect.options).some(o => o.value === preferredType);
                if (exists) issueTypeSelect.value = preferredType;
            } else {
                // Default to Bug if available
                const hasBug = Array.from(issueTypeSelect.options).some(o => o.value === 'Bug');
                if (hasBug) issueTypeSelect.value = 'Bug';
            }
        } catch (e) {
            console.error('Failed to load issue types, using defaults', e);
            ['Bug', 'Task', 'Story'].forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                issueTypeSelect.appendChild(opt);
            });
            if (preferredType) issueTypeSelect.value = preferredType;
        }
    }

    async getFields(projectKey) {
        // Try createmeta to get fields specific to the project/issue type
        try {
            const url = `${this.getBaseUrl()}${this.getApiPrefix()}/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes.fields`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.projects && data.projects.length > 0) {
                    const allFields = new Map();
                    // Merge fields from all issue types
                    for (const issueType of data.projects[0].issuetypes || []) {
                        for (const [key, field] of Object.entries(issueType.fields || {})) {
                            if (!allFields.has(key)) {
                                allFields.set(key, {
                                    key,
                                    name: field.name,
                                    required: field.required || false,
                                    custom: key.startsWith('customfield_'),
                                    schema: field.schema || null,
                                    allowedValues: field.allowedValues || null,
                                });
                            } else if (field.required) {
                                // Mark as required if required in any issue type
                                allFields.get(key).required = true;
                            }
                        }
                    }
                    return Array.from(allFields.values());
                }
            }
        } catch (e) {
            console.warn('createmeta fields failed, trying fallback', e);
        }

        // Fallback: generic field endpoint
        const url = `${this.getBaseUrl()}${this.getApiPrefix()}/field`;
        const response = await fetch(url, {
            headers: {
                'Authorization': this.getAuthHeader(),
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to fetch fields');
        const fields = await response.json();
        return fields.map(f => ({
            key: f.id || f.key,
            name: f.name,
            required: false,
            custom: f.custom || f.id?.startsWith('customfield_') || false,
            schema: f.schema || null,
            allowedValues: null,
        }));
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

        // Merge custom/required fields from settings
        if (issueData.customFields && typeof issueData.customFields === 'object') {
            for (const [key, val] of Object.entries(issueData.customFields)) {
                if (key && val) {
                    body.fields[key] = val;
                }
            }
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
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center;";

        modal.innerHTML = `
        <div style="background:#1e1e1e; border-radius:12px; width:550px; max-width:90%; position:relative; border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 40px rgba(0,0,0,0.5); color:#e8eaed; display:flex; flex-direction:column;">
            <div style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border-radius:12px 12px 0 0;">
                <span style="font-weight:600; font-size:16px; display:flex; align-items:center;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px;"><path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53zM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.78v1.72a4.36 4.36 0 0 0 4.34 4.34V7.63a.84.84 0 0 0-.84-.84H6.77zM2 11.6c0 2.4 1.94 4.34 4.34 4.35h1.78v1.72c.01 2.39 1.95 4.33 4.35 4.33v-9.56a.84.84 0 0 0-.84-.84H2z"/></svg>
                    Create JIRA Ticket
                </span>
                <span id="jira-close-btn" style="cursor:pointer; opacity:0.6; font-size:18px; padding:4px;">&times;</span>
            </div>

            <div style="padding:20px; max-height:70vh; overflow-y:auto;">
                <div id="jira-loading" style="color:#9aa0a6; font-size:14px; padding:20px 0; text-align:center;">Loading ${projectLabel.toLowerCase()}s...</div>

                <form id="jira-form" style="display:none; display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <label style="display:block; font-size:12px; color:#9aa0a6; margin-bottom:6px; font-weight:600;">${projectLabel}</label>
                        <select id="jira-project" style="width:100%; padding:10px 32px 10px 12px; background:#2a2a2a; color:#e8eaed; border:1px solid rgba(255,255,255,0.15); border-radius:6px; font-size:13px; font-family:inherit; outline:none; appearance:none; background-image:url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27%239aa0a6%27%3E%3Cpath d=%27M7 10l5 5 5-5z%27/%3E%3C/svg%3E'); background-repeat:no-repeat; background-position:right 10px center; box-sizing:border-box;"></select>
                    </div>

                    <div style="display:${componentDisplay}">
                        <label style="display:block; font-size:12px; color:#9aa0a6; margin-bottom:6px; font-weight:600;">Component</label>
                        <select id="jira-component" style="width:100%; padding:10px 32px 10px 12px; background:#2a2a2a; color:#e8eaed; border:1px solid rgba(255,255,255,0.15); border-radius:6px; font-size:13px; font-family:inherit; outline:none; appearance:none; background-image:url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27%239aa0a6%27%3E%3Cpath d=%27M7 10l5 5 5-5z%27/%3E%3C/svg%3E'); background-repeat:no-repeat; background-position:right 10px center; box-sizing:border-box;"><option value="">None</option></select>
                    </div>

                    <div>
                        <label style="display:block; font-size:12px; color:#9aa0a6; margin-bottom:6px; font-weight:600;">Issue Type</label>
                        <select id="jira-issue-type" style="width:100%; padding:10px 32px 10px 12px; background:#2a2a2a; color:#e8eaed; border:1px solid rgba(255,255,255,0.15); border-radius:6px; font-size:13px; font-family:inherit; outline:none; appearance:none; background-image:url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27%239aa0a6%27%3E%3Cpath d=%27M7 10l5 5 5-5z%27/%3E%3C/svg%3E'); background-repeat:no-repeat; background-position:right 10px center; box-sizing:border-box;">
                            <option value="">Loading...</option>
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:12px; color:#9aa0a6; margin-bottom:6px; font-weight:600;">Summary</label>
                        <input type="text" id="jira-summary" style="width:100%; padding:10px 12px; background:#2a2a2a; color:#e8eaed; border:1px solid rgba(255,255,255,0.15); border-radius:6px; font-size:13px; font-family:inherit; outline:none; box-sizing:border-box;" value="Bug Report: ">
                    </div>

                    <div>
                        <label style="display:block; font-size:12px; color:#9aa0a6; margin-bottom:6px; font-weight:600;">Labels <span style="font-size:11px; color:#80868b; font-weight:400;">(comma separated)</span></label>
                        <input type="text" id="jira-labels" style="width:100%; padding:10px 12px; background:#2a2a2a; color:#e8eaed; border:1px solid rgba(255,255,255,0.15); border-radius:6px; font-size:13px; font-family:inherit; outline:none; box-sizing:border-box;">
                    </div>

                    <div>
                        <label style="display:block; font-size:12px; color:#9aa0a6; margin-bottom:6px; font-weight:600;">Description</label>
                        <textarea id="jira-description" style="width:100%; padding:10px 12px; background:#2a2a2a; color:#e8eaed; border:1px solid rgba(255,255,255,0.15); border-radius:6px; font-size:13px; font-family:inherit; outline:none; box-sizing:border-box; resize:vertical; min-height:80px;" placeholder="Steps to reproduce:&#10;1. "></textarea>
                    </div>

                    <div style="display:flex; align-items:center; font-size:12px; color:#8ab4f8; padding:10px 12px; background:rgba(138,180,248,0.08); border-radius:6px; border:1px solid rgba(138,180,248,0.15);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px; flex-shrink:0;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        Attaching: ${attachmentName}
                    </div>

                    <div id="jira-error" style="padding:12px; border-radius:6px; font-size:13px; background:rgba(242,139,130,0.1); color:#f28b82; border:1px solid rgba(242,139,130,0.2); display:none;"></div>
                </form>
            </div>

            <div style="padding:15px 20px; border-top:1px solid rgba(255,255,255,0.1); display:flex; justify-content:flex-end; gap:12px;">
                <button type="button" id="jira-cancel-btn" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:#e8eaed; padding:8px 16px; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit;">Cancel</button>
                <button type="button" id="jira-submit-btn" style="background:#8ab4f8; border:1px solid #8ab4f8; color:#1e1e1e; padding:8px 16px; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:6px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53zM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.78v1.72a4.36 4.36 0 0 0 4.34 4.34V7.63a.84.84 0 0 0-.84-.84H6.77zM2 11.6c0 2.4 1.94 4.34 4.34 4.35h1.78v1.72c.01 2.39 1.95 4.33 4.35 4.33v-9.56a.84.84 0 0 0-.84-.84H2z"/></svg>
                    Create Ticket
                </button>
            </div>
        </div>
    `;


        document.body.appendChild(modal);

        const close = () => document.body.removeChild(modal);
        document.getElementById('jira-close-btn').onclick = close;
        document.getElementById('jira-cancel-btn').onclick = close;
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        const projectSelect = document.getElementById('jira-project');
        const componentSelect = document.getElementById('jira-component');
        const issueTypeSelect = document.getElementById('jira-issue-type');
        const submitBtn = document.getElementById('jira-submit-btn');

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
                    if (projects.some(p => p.key === lastP)) {
                        projectSelect.value = lastP;
                    }
                }

                document.getElementById('jira-loading').style.display = 'none';
                document.getElementById('jira-form').style.display = 'flex';

                // Load components and issue types for current project
                this.loadComponents(projectSelect.value, componentSelect, lastC);
                this.loadIssueTypes(projectSelect.value, issueTypeSelect, lastT);

                // Setup listener for future changes
                projectSelect.addEventListener('change', () => {
                    this.loadComponents(projectSelect.value, componentSelect);
                    this.loadIssueTypes(projectSelect.value, issueTypeSelect);
                });

            }).catch(err => {
                document.getElementById('jira-loading').textContent = "Error: " + err.message;
                document.getElementById('jira-loading').style.color = '#f28b82';
            });
        });

        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
            const origHTML = submitBtn.innerHTML;
            submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="animation:jira-spin 1s linear infinite;"><path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" fill="currentColor"/></svg> Creating...`;
            const errorDiv = document.getElementById('jira-error');
            errorDiv.style.display = 'none';
            errorDiv.textContent = "";

            // Add spin animation if not already present
            if (!document.getElementById('jira-spin-style')) {
                const style = document.createElement('style');
                style.id = 'jira-spin-style';
                style.textContent = '@keyframes jira-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
                document.head.appendChild(style);
            }

            const summary = document.getElementById('jira-summary').value;
            const description = document.getElementById('jira-description').value;

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

                submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="animation:jira-spin 1s linear infinite;"><path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" fill="currentColor"/></svg> Uploading Attachment...`;

                await this.addAttachment(issue.key, attachmentBlob, attachmentName);

                // Show success with Open in Jira link
                const ticketUrl = `https://${this.config.domain}/browse/${issue.key}`;
                submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Created: ${issue.key}`;
                submitBtn.style.background = '#81c995';
                submitBtn.style.borderColor = '#81c995';

                // Show open link in error div area (repurposed for success)
                errorDiv.style.display = 'block';
                errorDiv.style.background = 'rgba(129,201,149,0.1)';
                errorDiv.style.color = '#81c995';
                errorDiv.style.borderColor = 'rgba(129,201,149,0.2)';
                errorDiv.innerHTML = `Ticket <strong>${issue.key}</strong> created with attachment. <a href="${ticketUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:4px; margin-left:8px; padding:4px 10px; background:rgba(129,201,149,0.15); border:1px solid rgba(129,201,149,0.3); border-radius:4px; color:#81c995; font-size:12px; font-weight:600; text-decoration:none;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open in Jira</a>`;

                // Change Cancel to Close
                document.getElementById('jira-cancel-btn').textContent = 'Close';
            } catch (err) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.innerHTML = origHTML;
                errorDiv.textContent = err.message;
                errorDiv.style.display = 'block';
            }
        });
    }
}

window.jiraHelper = new JiraHelper();
