/**
 * Sub-aba Apontamentos — fallback até view transacional dedicada.
 */
export function renderOperacoesApontamentos(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="field-apontamentos-fallback">
            <span class="field-apontamentos-badge">Camada futura</span>
            <h3>Apontamentos analíticos</h3>
            <p>Esta demo já consolida <strong>produtividade</strong>, <strong>custos por talhão</strong> e <strong>uso de máquinas</strong> nas sub-abas Talhões e Máquinas.</p>
            <p>A abertura transacional por data/operação depende de uma view futura de apontamentos.</p>
            <div class="field-apontamentos-fields" aria-label="Dados esperados">
                <span class="field-apontamentos-field">Data</span>
                <span class="field-apontamentos-field">Talhão</span>
                <span class="field-apontamentos-field">Cultura</span>
                <span class="field-apontamentos-field">Operação</span>
                <span class="field-apontamentos-field">Recurso</span>
                <span class="field-apontamentos-field">Quantidade</span>
                <span class="field-apontamentos-field">Custo</span>
            </div>
            <p class="field-apontamentos-future">Preparado para integração futura · Próxima camada: apontamentos transacionais</p>
        </div>
    `;
}
