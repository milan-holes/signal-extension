/**
 * Smart DOM element resolution for user-drawn highlight rectangles
 *
 * Instead of climbing the DOM tree (which leads to body/html),
 * this samples points inside the highlight and scores candidates by overlap,
 * semantic value, and size ratio.
 */

interface Point {
    x: number;
    y: number;
}

interface ScoredElement {
    el: Element;
    score: number;
}

export interface ResolvedElement {
    selector: string;
    outerHTML: string;
    textContent: string;
    score: number;
    dataAttributes: Record<string, string>;
    tagName: string;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface HighlightResolution {
    resolvedElements: ResolvedElement[];
    primaryElement?: ResolvedElement;
    selectedText?: string;
}

const BLOCKED_TAGS = new Set(['html', 'body', 'main', 'header', 'footer', 'nav', 'aside']);
const SCORE_THRESHOLD = 2.0;

const SEMANTIC_BONUS_TAGS = new Set([
    'p', 'span', 'td', 'th', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'button', 'label', 'time', 'strong', 'em', 'code', 'pre',
    'input', 'textarea', 'select', 'img', 'video', 'canvas'
]);

const GENERIC_PENALTY_TAGS = new Set([
    'div', 'section', 'article', 'figure', 'form'
]);

export function useHighlightResolver() {

    /**
     * Compute the overlap ratio between two rectangles
     */
    function computeOverlapRatio(rect1: DOMRect, rect2: DOMRect): number {
        const x1 = Math.max(rect1.left, rect2.left);
        const y1 = Math.max(rect1.top, rect2.top);
        const x2 = Math.min(rect1.right, rect2.right);
        const y2 = Math.min(rect1.bottom, rect2.bottom);

        if (x2 <= x1 || y2 <= y1) return 0;

        const intersectionArea = (x2 - x1) * (y2 - y1);
        const rect2Area = rect2.width * rect2.height;

        return rect2Area > 0 ? intersectionArea / rect2Area : 0;
    }

    /**
     * Score a candidate element based on how well it matches the highlight
     */
    function scoreCandidate(el: Element, highlightRect: DOMRect): number {
        const elRect = el.getBoundingClientRect();
        const overlap = computeOverlapRatio(elRect, highlightRect);

        if (overlap < 0.1) return 0;

        let score = overlap * 2.0;

        const tag = el.tagName.toLowerCase();

        // Semantic tag bonus
        if (SEMANTIC_BONUS_TAGS.has(tag)) score += 3;

        // Generic wrapper penalty
        if (GENERIC_PENALTY_TAGS.has(tag)) score -= 2;

        // Has meaningful text content
        if (el.textContent?.trim()) score += 2;

        // Has test/data attributes
        if (el.hasAttribute('data-testid') ||
            el.hasAttribute('data-cy') ||
            el.hasAttribute('data-test') ||
            el.hasAttribute('data-qa') ||
            el.hasAttribute('data-id')) {
            score += 1;
        }

        // Penalize elements much larger than the highlight (likely wrappers)
        const areaRatio = (elRect.width * elRect.height) / (highlightRect.width * highlightRect.height);
        if (areaRatio > 4) score -= 2;
        if (areaRatio > 10) score -= 3;

        return score;
    }

    /**
     * Remove redundant ancestors from scored elements
     */
    function deduplicateByAncestry(scored: ScoredElement[]): ScoredElement[] {
        return scored.filter(({ el }) => {
            // Keep this element if no other element contains it with a higher score
            return !scored.some(({ el: other, score: otherScore }) => {
                if (other === el) return false;
                if (!other.contains(el)) return false;
                // If parent has higher score, remove child
                return otherScore >= scored.find(s => s.el === el)!.score;
            });
        });
    }

    /**
     * Extract detailed information from an element
     */
    function extractElementInfo(el: Element, score: number, selectorFn: (el: Element) => string): ResolvedElement {
        const rect = el.getBoundingClientRect();

        // Collect data attributes
        const dataAttributes: Record<string, string> = {};
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
                dataAttributes[attr.name] = attr.value;
            }
        });

        // Get outer HTML (limited to avoid huge payloads)
        let outerHTML = el.outerHTML;
        if (outerHTML.length > 500) {
            outerHTML = outerHTML.substring(0, 500) + '...';
        }

        return {
            selector: selectorFn(el),
            outerHTML,
            textContent: (el.textContent || '').trim().substring(0, 200),
            score,
            dataAttributes,
            tagName: el.tagName.toLowerCase(),
            boundingBox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            }
        };
    }

    /**
     * Generate a CSS selector for an element
     */
    function generateSelector(el: Element): string {
        // Try test attributes first
        const testAttrs = ['data-testid', 'data-cy', 'data-test', 'data-qa', 'data-id'];
        for (const attr of testAttrs) {
            const val = el.getAttribute(attr);
            if (val) {
                return `[${attr}="${val}"]`;
            }
        }

        // Try ID
        if (el.id) {
            return `#${CSS.escape(el.id)}`;
        }

        // Build path with nth-of-type
        const path: string[] = [];
        let current: Element | null = el;

        while (current && current !== document.documentElement && path.length < 5) {
            let selector = current.tagName.toLowerCase();

            // Check if has unique test attribute at this level
            let hasUniqueAttr = false;
            for (const attr of testAttrs) {
                const val = current.getAttribute(attr);
                if (val) {
                    selector = `[${attr}="${val}"]`;
                    hasUniqueAttr = true;
                    break;
                }
            }

            if (!hasUniqueAttr && current.id) {
                selector = `#${CSS.escape(current.id)}`;
                path.unshift(selector);
                break;
            }

            if (!hasUniqueAttr) {
                // Add nth-of-type if needed
                let index = 1;
                let sibling = current.previousElementSibling;
                while (sibling) {
                    if (sibling.tagName === current.tagName) index++;
                    sibling = sibling.previousElementSibling;
                }
                if (index > 1 || current.nextElementSibling?.tagName === current.tagName) {
                    selector += `:nth-of-type(${index})`;
                }
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    /**
     * Resolve highlight rectangle to meaningful DOM elements
     */
    function resolveHighlightToElements(rect: { x: number; y: number; width: number; height: number }): HighlightResolution {
        // 1. Sample a 3×3 grid of points inside the highlight
        const points: Point[] = [];
        for (const px of [0.2, 0.5, 0.8]) {
            for (const py of [0.2, 0.5, 0.8]) {
                points.push({
                    x: rect.x + rect.width * px,
                    y: rect.y + rect.height * py
                });
            }
        }

        // 2. Collect all elements under those points (deduplicated)
        const seen = new Set<Element>();
        const candidates: Element[] = [];

        for (const { x, y } of points) {
            const elementsAtPoint = document.elementsFromPoint(x, y);
            for (const el of elementsAtPoint) {
                if (!seen.has(el)) {
                    seen.add(el);
                    candidates.push(el);
                }
            }
        }

        // 3. Score each candidate
        const highlightDOMRect = new DOMRect(rect.x, rect.y, rect.width, rect.height);

        const scored = candidates
            .filter(el => !BLOCKED_TAGS.has(el.tagName.toLowerCase()))
            .map(el => ({ el, score: scoreCandidate(el, highlightDOMRect) }))
            .filter(({ score }) => score > SCORE_THRESHOLD)
            .sort((a, b) => b.score - a.score);

        // 4. Deduplicate by ancestry
        const deduplicated = deduplicateByAncestry(scored);

        // 5. Extract element info
        const resolvedElements = deduplicated.map(({ el, score }) =>
            extractElementInfo(el, score, generateSelector)
        );

        // 6. Capture selected text if any
        const selection = window.getSelection();
        const selectedText = selection && selection.toString().trim()
            ? selection.toString().trim()
            : undefined;

        return {
            resolvedElements,
            primaryElement: resolvedElements[0],
            selectedText
        };
    }

    return {
        resolveHighlightToElements
    };
}
