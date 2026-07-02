/**
 * Drawer lateral / bottom sheet para drill-down analítico.
 */

let backdropEl;
let drawerEl;
let titleEl;
let subtitleEl;
let statusEl;
let bodyEl;
let insightEl;
let actionEl;
let closeBtn;

let onCloseCallback = null;

export function initDrilldown(onClose) {
    onCloseCallback = typeof onClose === 'function' ? onClose : null;
    backdropEl = document.getElementById('drilldown-backdrop');
    drawerEl = document.getElementById('drilldown-drawer');
    titleEl = document.getElementById('drilldown-title');
    subtitleEl = document.getElementById('drilldown-subtitle');
    statusEl = document.getElementById('drilldown-status');
    bodyEl = document.getElementById('drilldown-body');
    insightEl = document.getElementById('drilldown-insight');
    actionEl = document.getElementById('drilldown-action');
    closeBtn = document.getElementById('drilldown-close');

    closeBtn?.addEventListener('click', closeDrilldown);
    backdropEl?.addEventListener('click', closeDrilldown);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && drawerEl?.classList.contains('open')) closeDrilldown();
    });
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} [opts.status] - ok | warn | critical
 * @param {string} [opts.statusLabel]
 * @param {Array<{label:string,value:string,highlight?:boolean}>} opts.metrics
 * @param {{title:string,text:string,tone?:string}} [opts.insight]
 * @param {string} [opts.nextAction]
 */
export function openDrilldown({ title, subtitle, status, statusLabel, metrics = [], insight, nextAction, filterContext }) {
    if (!drawerEl) return;

    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) {
        subtitleEl.textContent = subtitle || '';
        subtitleEl.classList.toggle('hidden', !subtitle);
    }
    const filterCtxEl = document.getElementById('drilldown-filter-context');
    if (filterCtxEl) {
        if (filterContext) {
            filterCtxEl.textContent = filterContext;
            filterCtxEl.classList.remove('hidden');
        } else {
            filterCtxEl.classList.add('hidden');
            filterCtxEl.textContent = '';
        }
    }
    if (statusEl) {
        if (status && statusLabel) {
            statusEl.className = `status-pill status-pill--${status}`;
            statusEl.textContent = statusLabel;
            statusEl.classList.remove('hidden');
        } else {
            statusEl.classList.add('hidden');
        }
    }
    if (bodyEl) {
        bodyEl.innerHTML = metrics.map(m => `
            <div class="drill-metric${m.highlight ? ' drill-metric--highlight' : ''}">
                <span class="drill-metric-label">${m.label}</span>
                <span class="drill-metric-value"${m.title ? ` title="${m.title}"` : ''}>${m.value}</span>
            </div>
        `).join('');
    }
    if (insightEl) {
        if (insight) {
            insightEl.className = `drilldown-insight drilldown-insight--${insight.tone || 'info'}`;
            insightEl.innerHTML = `
                <h4>${insight.title}</h4>
                <p>${insight.text}</p>
            `;
            insightEl.classList.remove('hidden');
        } else {
            insightEl.classList.add('hidden');
            insightEl.innerHTML = '';
        }
    }
    if (actionEl) {
        if (nextAction) {
            actionEl.className = 'drilldown-action';
            actionEl.innerHTML = `<p><strong>Próxima ação:</strong> ${nextAction}</p>`;
            actionEl.classList.remove('hidden');
        } else {
            actionEl.classList.add('hidden');
            actionEl.innerHTML = '';
        }
    }

    backdropEl?.classList.add('open');
    drawerEl.classList.add('open');
    drawerEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drilldown-open');
    closeBtn?.focus();
}

export function closeDrilldown() {
    backdropEl?.classList.remove('open');
    drawerEl?.classList.remove('open');
    drawerEl?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drilldown-open');
    onCloseCallback?.();
}
