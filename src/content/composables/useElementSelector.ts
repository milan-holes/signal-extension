export function useElementSelector() {

    const getCssSelector = (element: Element | null): string => {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';

        // Check if element is inside extension UI (shadow DOM)
        let checkEl = element as Element | null;
        while (checkEl) {
            if (checkEl.id === 'signal-root' || checkEl.id === 'signal-replay-widget-root') {
                console.warn('[Signal] Attempted to generate selector for extension UI element');
                return '';
            }
            checkEl = checkEl.parentElement;
        }

        const testAttrs = ['data-testid', 'data-cy', 'data-test', 'data-qa', 'data-id', 'data-e2e'];
        for (const attr of testAttrs) {
            const val = element.getAttribute(attr);
            if (val) {
                const safeVal = val.replace(/(['"\\])/g, '\\$1');
                const sel = `[${attr}="${safeVal}"]`;
                try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (e) { }
            }
        }

        if (element.id) {
            try {
                const idSel = `#${CSS.escape(element.id)}`;
                if (document.querySelectorAll(idSel).length === 1) return idSel;
            } catch (e) { }
        }

        let path: string[] = [];
        let current: Element | null = element;
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();

            let hasUniqueAttr = false;
            for (const attr of testAttrs) {
                const val = current.getAttribute(attr);
                if (val) {
                    const safeVal = val.replace(/(['"\\])/g, '\\$1');
                    selector = `[${attr}="${safeVal}"]`;
                    hasUniqueAttr = true;
                    break;
                }
            }

            if (!hasUniqueAttr && current.id) {
                try {
                    const idSel = `#${CSS.escape(current.id)}`;
                    if (document.querySelectorAll(idSel).length === 1) {
                        path.unshift(idSel);
                        return path.join(' > ');
                    } else {
                        selector = idSel;
                        hasUniqueAttr = true;
                    }
                } catch (e) { }
            }

            if (!hasUniqueAttr) {
                let index = 1;
                let sibling = current.previousElementSibling;
                let hasSameTagSiblings = false;

                while (sibling) {
                    if (sibling.tagName === current.tagName) { index++; hasSameTagSiblings = true; }
                    sibling = sibling.previousElementSibling;
                }
                let nextSibling = current.nextElementSibling;
                while (nextSibling && !hasSameTagSiblings) {
                    if (nextSibling.tagName === current.tagName) { hasSameTagSiblings = true; }
                    nextSibling = nextSibling.nextElementSibling;
                }

                if (hasSameTagSiblings || index > 1) {
                    selector += `:nth-of-type(${index})`;
                }
            }

            path.unshift(selector);
            const fullSelector = path.join(' > ');
            try {
                if (document.querySelectorAll(fullSelector).length === 1) {
                    return fullSelector;
                }
            } catch (e) { }

            current = current.parentElement;
        }

        return path.join(' > ');
    };

    const getXPath = (element: Element | null): string => {
        if (!element) return '';
        if (element.id !== '') {
            return `id("${element.id}")`;
        }
        if (element === document.body) {
            return '/html/body';
        }

        let ix = 0;
        const siblings = element.parentNode?.childNodes;
        if (siblings) {
            for (let i = 0; i < siblings.length; i++) {
                const sibling = siblings[i] as Element;
                if (sibling === element) {
                    const parentXPath = getXPath(element.parentElement) || '';
                    return `${parentXPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
                }
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) {
                    ix++;
                }
            }
        }
        return '';
    };

    const getSelectorPath = (element: Element | null) => {
        if (!element) return [];

        const standardClickable = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA']);
        const containerTags = new Set(['NAV', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'SECTION', 'ARTICLE', 'FORM', 'DIALOG']);

        const isInteractive = (el: Element) => standardClickable.has(el.tagName);

        const isContainer = (el: Element) => {
            if (containerTags.has(el.tagName)) return true;
            const role = el.getAttribute('role');
            if (role && ['navigation', 'banner', 'main', 'complementary', 'contentinfo', 'form', 'dialog', 'toolbar', 'menu', 'menubar', 'tablist'].includes(role.toLowerCase())) return true;
            return false;
        };

        const buildLayer = (el: Element | HTMLElement) => {
            return {
                tagName: el.tagName,
                id: el.id || null,
                selector: getCssSelector(el),
                xpath: getXPath(el),
                role: el.getAttribute('role') || null,
                text: ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim().substring(0, 80) || null,
                ariaLabel: el.getAttribute('aria-label') || null
            };
        };

        const path = [];

        // Layer 0: Deep Target (the actual e.target)
        // @ts-ignore dynamic type builder
        path.push({ ...buildLayer(element), role_in_path: 'deepTarget' });

        let interactiveFound = false;
        let containerFound = false;
        let current = element.parentElement;

        while (current && current !== document.body && current !== document.documentElement) {
            if (!interactiveFound && isInteractive(current)) {
                if (current !== element) {
                    // @ts-ignore
                    path.push({ ...buildLayer(current), role_in_path: 'interactiveParent' });
                }
                interactiveFound = true;
            } else if (interactiveFound && !containerFound && isContainer(current)) {
                // @ts-ignore
                path.push({ ...buildLayer(current), role_in_path: 'container' });
                containerFound = true;
                break;
            }
            current = current.parentElement;
        }

        if (!interactiveFound && isInteractive(element)) {
            // @ts-ignore
            path[0].role_in_path = 'interactiveParent';
        }

        return path;
    };

    const getElementBundle = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const boundingBox = {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            bottom: Math.round(rect.bottom),
            right: Math.round(rect.right)
        };

        let nearestHeading = null;
        let current: Element | null = element;
        const headings = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

        while (current && current !== document.body && !nearestHeading) {
            if (headings.includes(current.tagName)) {
                nearestHeading = (current as HTMLElement).innerText;
                break;
            }

            let sibling: Element | null = current.previousElementSibling;
            while (sibling) {
                if (headings.includes(sibling.tagName)) {
                    nearestHeading = (sibling as HTMLElement).innerText;
                    break;
                }
                sibling = sibling.previousElementSibling;
            }
            current = current.parentElement;
        }

        return {
            tagName: element.tagName,
            id: element.id || null,
            className: element.className || null,
            xpath: getXPath(element),
            selectors: [getCssSelector(element)],
            text: ((element as HTMLElement).innerText || '').trim().substring(0, 100),
            attributes: {
                type: element.getAttribute('type'),
                name: element.getAttribute('name'),
                placeholder: element.getAttribute('placeholder'),
                href: element.getAttribute('href'),
                src: element.getAttribute('src'),
                value: (element as HTMLInputElement).value || null,
            },
            boundingBox,
            path: getSelectorPath(element),
            nearestHeading: nearestHeading ? nearestHeading.trim().substring(0, 60) : null
        };
    };

    return {
        getCssSelector,
        getXPath,
        getSelectorPath,
        getElementBundle
    };
}
