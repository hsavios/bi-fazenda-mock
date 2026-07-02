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
 * @param {Array<{label:string,value:string,highlight?:boolean}>} [opts.metrics]
 * @param {{title:string,text:string,tone?:string}} [opts.insight]
 * @param {string} [opts.nextAction]
 * @param {string} [opts.contentHtml] - HTML customizado no corpo
 * @param {function} [opts.onOpen] - callback após abrir (ex.: init chart)
 * @param {function} [opts.onAction] - callback do botão de ação
 * @param {string} [opts.actionLabel]
 * @param {'default'|'wide'} [opts.drawerSize]
 */
export function openDrilldown({
    title, subtitle, status, statusLabel, metrics = [], rows, insight, nextAction,
    filterContext, source, contentHtml, onOpen, onAction, actionLabel, drawerSize = 'default'
}) {
    if (!drawerEl) return;

    drawerEl.classList.toggle('drilldown-drawer--wide', drawerSize === 'wide');

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
        if (contentHtml) {
            bodyEl.innerHTML = contentHtml;
        } else {
            let html = metrics.map(m => `
                <div class="drill-metric${m.highlight ? ' drill-metric--highlight' : ''}">
                    <span class="drill-metric-label">${m.label}</span>
                    <span class="drill-metric-value"${m.title ? ` title="${m.title}"` : ''}>${m.value}</span>
                </div>
            `).join('');
            if (rows?.length) {
                html += `<div class="drill-rows"><h4 class="drill-rows-title">Detalhes</h4>${rows.map(r => `
                    <div class="drill-row">
                        <span class="drill-row-label">${r.label}</span>
                        <span class="drill-row-value">${r.value}</span>
                        ${r.meta ? `<span class="drill-row-meta">${r.meta}</span>` : ''}
                    </div>
                `).join('')}</div>`;
            }
            bodyEl.innerHTML = html;
        }
    }
    const sourceEl = document.getElementById('drilldown-source');
    if (sourceEl) {
        if (source) {
            sourceEl.textContent = `Fonte: ${source}`;
            sourceEl.classList.remove('hidden');
        } else {
            sourceEl.classList.add('hidden');
            sourceEl.textContent = '';
        }
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
        if (onAction && actionLabel) {
            actionEl.className = 'drilldown-action drilldown-action--btn';
            actionEl.innerHTML = `<button type="button" class="dre-panel-action-btn">${actionLabel}</button>`;
            actionEl.classList.remove('hidden');
            actionEl.querySelector('button')?.addEventListener('click', onAction, { once: true });
        } else if (nextAction) {
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
    onOpen?.();
}

export function closeDrilldown() {
    backdropEl?.classList.remove('open');
    drawerEl?.classList.remove('open');
    drawerEl?.classList.remove('drilldown-drawer--wide');
    drawerEl?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drilldown-open');
    onCloseCallback?.();
}
