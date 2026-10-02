import { CLASS_CATALOG } from '../classes/classCatalog.js';
import { RESOURCE_CATALOG } from '../inventory/Inventory.js';
import { StatsSystem } from '../stats/StatsSystem.js';
import { SkillProgression } from '../skills/SkillProgression.js';
import { MapRenderer } from './MapRenderer.js';
import { CraftingSystem, RECIPES } from '../crafting/CraftingSystem.js';
import { EquipmentSystem, EQUIPMENT_SLOTS } from '../inventory/EquipmentSystem.js';
import { DUNGEONS } from '../combat/DungeonSystem.js';
import { BiomeSystem } from '../world/BiomeSystem.js';

const ATTRIBUTE_LABELS = { strength: 'Força', agility: 'Agilidade', dexterity: 'Destreza', intelligence: 'Inteligência', life: 'Vida', physicalDefense: 'Def. física', magicDefense: 'Def. mágica', accuracy: 'Precisão', evasion: 'Esquiva' };
const PRIMARY_ATTRIBUTES = ['strength', 'agility', 'dexterity', 'intelligence', 'life'];
const ATTRIBUTE_HELP = {
  strength: 'Aumenta o dano físico e contribui para a defesa física.',
  agility: 'Aumenta a esquiva e contribui um pouco para a defesa física.',
  dexterity: 'Aumenta a precisão dos ataques e dá um pequeno bônus de dano.',
  intelligence: 'Aumenta a defesa mágica; ainda não há inimigos mágicos no protótipo.',
  life: 'Aumenta a vida máxima em 10 por ponto e contribui para a defesa mágica.',
  physicalDefense: 'Derivada de Força e Agilidade; reduz parte do dano físico recebido.',
  magicDefense: 'Derivada de Inteligência e Vida; reservada a futuras fontes de dano mágico.',
  accuracy: 'Define a chance percentual de acertar ataques.',
  evasion: 'Dá uma chance percentual de evitar completamente um golpe físico.'
};

export class UIController {
  constructor({ getCharacter, onCreateCharacter, onAllocate, onCraft, onNewJourney, onUpgradeSkill, onUiSound, onUsePotion, onToggleAuto, onPotionSettings, onPartyCreate, onPartyJoin, onPartyShare, onEquipItem, onSalvage, onDungeonStart, onTeleportTown, getParty }) {
    this.getCharacter = getCharacter;
    this.actions = { onCreateCharacter, onAllocate, onCraft, onNewJourney, onUpgradeSkill, onUiSound, onUsePotion, onToggleAuto, onPotionSettings, onPartyCreate, onPartyJoin, onPartyShare, onEquipItem, onSalvage, onDungeonStart, onTeleportTown, getParty };
    this.mapRenderer = new MapRenderer();
    this.lastCharacter = null;
    this.lastChunks = [];
    this.lastSkillStates = [];
    this.lastMiniMapDraw = 0;
    this.lastWorldMapDraw = 0;
    this.inventoryTab = 'collected';
    this.inventorySorted = false;
    this.selectedItems = new Set();
    this.compareItemId = null;
    this.bind();
  }
  bind() {
    document.querySelectorAll('.class-card').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('.class-card').forEach((card) => card.classList.toggle('selected', card === button));
    }));
    document.querySelector('#begin-adventure').addEventListener('click', () => {
      const selected = document.querySelector('.class-card.selected')?.dataset.class ?? 'warrior';
      const name = document.querySelector('#character-name').value;
      this.actions.onCreateCharacter(name, selected);
    });
    document.querySelector('#create-again').addEventListener('click', () => this.actions.onNewJourney());
    document.querySelector('#new-run').addEventListener('click', () => {
      if (this.getCharacter()?.status === 'alive' && confirm('Encerrar este personagem para sempre e começar outro?')) this.actions.onNewJourney();
    });
    document.querySelector('#craft-button').addEventListener('click', () => this.toggleModal('crafting-modal', true));
    document.querySelector('#open-crafting').addEventListener('click', () => this.toggleModal('crafting-modal', true));
    document.querySelector('#open-auto-potions').addEventListener('click', () => this.openPotionSettings());
    document.querySelector('#open-party').addEventListener('click', () => this.toggleModal('party-modal', true));
    document.querySelector('#open-dungeons').addEventListener('click', () => this.toggleModal('dungeons-modal', true));
    document.querySelector('#dungeon-level-filter').addEventListener('change', () => this.renderDungeons(this.getCharacter(), this.actions.getParty?.()));
    document.querySelector('#dungeon-mechanic-filter').addEventListener('change', () => this.renderDungeons(this.getCharacter(), this.actions.getParty?.()));
    document.querySelector('#dungeon-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-enter-dungeon]');
      if (button) this.actions.onDungeonStart?.(button.dataset.enterDungeon, button.dataset.mode === 'solo');
    });
    document.querySelector('#inventory-content').addEventListener('click', (event) => {
      const compare = event.target.closest('[data-compare-item]');
      if (compare) { this.openItemComparison(compare.dataset.compareItem); return; }
      const equip = event.target.closest('[data-equip-item]');
      if (equip) this.actions.onEquipItem?.(equip.dataset.equipItem);
    });
    document.querySelector('#inventory-content').addEventListener('change', (event) => {
      const selection = event.target.closest('input[data-select-item]');
      if (selection) { this.toggleItemSelection(selection.dataset.selectItem, selection.checked); this.renderInventory(this.getCharacter(), true); }
    });
    document.querySelector('#salvage-selected').addEventListener('click', () => {
      if (this.selectedItems.size && confirm(`Desmontar ${this.selectedItems.size} seleção(ões)? Os materiais serão convertidos em fragmentos.`)) this.actions.onSalvage?.([...this.selectedItems]);
    });
    document.querySelector('#equip-compared-item').addEventListener('click', () => {
      if (this.compareItemId) this.actions.onEquipItem?.(this.compareItemId);
      this.toggleModal('item-compare-modal', false);
    });
    document.querySelector('#create-party').addEventListener('click', () => this.actions.onPartyCreate?.());
    document.querySelector('#join-party').addEventListener('click', () => this.actions.onPartyJoin?.(document.querySelector('#party-invite-link').value));
    document.querySelector('#share-party').addEventListener('click', () => this.actions.onPartyShare?.());
    document.querySelector('#crafting-list').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-recipe]');
      if (button) this.actions.onCraft?.(button.dataset.recipe);
    });
    for (const kind of ['hp', 'mana']) {
      document.querySelector(`#auto-${kind}-enabled`).addEventListener('change', (event) => this.actions.onPotionSettings?.(kind, { enabled: event.target.checked }));
      const slider = document.querySelector(`#${kind}-threshold`);
      slider.addEventListener('input', () => { document.querySelector(`#${kind}-threshold-value`).textContent = `${slider.value}%`; });
      slider.addEventListener('change', () => this.actions.onPotionSettings?.(kind, { threshold: Number(slider.value) }));
    }
    document.addEventListener('farm-party-updated', (event) => this.renderParty(event.detail));
    document.querySelector('#attribute-list').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-attribute]');
      if (button) this.actions.onAllocate(button.dataset.attribute);
    });
    document.querySelector('#skill-tree').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-skill-id]');
      if (button) this.actions.onUpgradeSkill(button.dataset.skillId);
    });
    document.querySelector('#skill-hud').addEventListener('click', (event) => {
      const button = event.target.closest('[data-skill-detail]');
      if (!button) return;
      this.skillTreeSignature = null;
      const character = this.getCharacter();
      if (character) this.renderSkills(character, this.lastSkillStates);
      this.toggleModal('skills-modal', true);
      document.querySelector(`[data-skill-id="${button.dataset.skillDetail}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    document.querySelector('#open-skills').addEventListener('click', () => this.toggleModal('skills-modal', true));
    document.querySelector('#open-world-map').addEventListener('click', () => this.toggleModal('world-map-modal', true));
    const miniMap = document.querySelector('#minimap');
    miniMap.tabIndex = 0;
    miniMap.style.cursor = 'pointer';
    miniMap.setAttribute('role', 'button');
    miniMap.title = 'Clique para abrir o mapa-múndi';
    miniMap.addEventListener('click', () => this.toggleModal('world-map-modal', true));
    miniMap.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') this.toggleModal('world-map-modal', true); });
    document.querySelector('#teleport-town').addEventListener('click', () => this.actions.onTeleportTown?.());
    document.querySelector('#open-inventory').addEventListener('click', () => this.toggleModal('inventory-modal', true));
    document.querySelector('#open-stat-guide').addEventListener('click', () => this.toggleModal('stat-guide-modal', true));
    const toggleJournal = () => {
      const panel = document.querySelector('#journey-panel');
      const expanded = panel.classList.toggle('collapsed') === false;
      document.querySelector('#toggle-journal').setAttribute('aria-expanded', String(expanded));
      document.querySelector('#toggle-journal-panel').setAttribute('aria-expanded', String(expanded));
      this.actions.onUiSound?.('click');
    };
    document.querySelector('#toggle-journal').addEventListener('click', toggleJournal);
    document.querySelector('#toggle-journal-panel').addEventListener('click', toggleJournal);
    document.querySelector('#toggle-auto').addEventListener('click', () => this.actions.onToggleAuto?.());
    document.querySelector('#use-hp-potion').addEventListener('click', () => this.actions.onUsePotion?.('hp'));
    document.querySelector('#use-mana-potion').addEventListener('click', () => this.actions.onUsePotion?.('mana'));
    document.querySelector('#inventory-tabs').addEventListener('click', (event) => {
      const tab = event.target.closest('button[data-tab]');
      if (!tab) return;
      this.inventoryTab = tab.dataset.tab;
      document.querySelectorAll('.inventory-tab').forEach((button) => button.classList.toggle('active', button === tab));
      this.renderInventory(this.getCharacter());
    });
    document.querySelector('#organize-inventory').addEventListener('click', () => {
      this.inventorySorted = !this.inventorySorted;
      this.actions.onUiSound?.('click');
      this.renderInventory(this.getCharacter());
    });
    document.addEventListener('keydown', (event) => {
      if (event.repeat || event.target instanceof Element && event.target.matches('input,textarea,select,button,[role="button"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'b') this.toggleModal('inventory-modal', true);
      if (key === 'c') this.toggleModal('crafting-modal', true);
      if (key === 'p') this.toggleModal('party-modal', true);
      if (key === 'g') this.toggleModal('dungeons-modal', true);
      if (key === 'm') this.toggleModal('world-map-modal', true);
      if (key === 'k') this.toggleModal('skills-modal', true);
      if (key === 'i') this.toggleModal('stat-guide-modal', true);
      if (key === 'j') toggleJournal();
      if (event.code === 'Space') { event.preventDefault(); this.actions.onToggleAuto?.(); }
    });
    document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => this.toggleModal(button.dataset.closeModal, false)));
    document.querySelectorAll('.utility-modal').forEach((modal) => modal.addEventListener('click', (event) => {
      if (event.target === modal) this.toggleModal(modal.id, false);
    }));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') document.querySelectorAll('.utility-modal:not(.hidden)').forEach((modal) => this.toggleModal(modal.id, false));
    });
  }
  toggleModal(id, open) {
    if (open && !this.getCharacter()) return;
    document.getElementById(id).classList.toggle('hidden', !open);
    if (open) {
      this.actions.onUiSound?.('map');
      if (id === 'world-map-modal') this.mapRenderer.drawWorld(document.querySelector('#world-map'), this.getCharacter());
      if (id === 'inventory-modal') this.renderInventory(this.getCharacter());
      if (id === 'dungeons-modal') this.renderDungeons(this.getCharacter(), this.actions.getParty?.());
      if (id === 'crafting-modal') this.renderCrafting(this.getCharacter());
      if (id === 'auto-potions-modal') this.renderPotionSettings(this.getCharacter());
      if (id === 'skills-modal') {
        this.skillTreeSignature = null;
        this.renderSkills(this.getCharacter(), this.lastSkillStates);
      }
    }
  }
  openPotionSettings() { this.renderPotionSettings(this.getCharacter()); this.toggleModal('auto-potions-modal', true); }
  renderPotionSettings(character) {
    if (!character) return;
    character.autoPotion ??= { hpEnabled: true, manaEnabled: true, hpThreshold: 60, manaThreshold: 35 };
    const settings = character.autoPotion;
    document.querySelector('#auto-hp-enabled').checked = Boolean(settings.hpEnabled);
    document.querySelector('#auto-mana-enabled').checked = Boolean(settings.manaEnabled);
    for (const kind of ['hp', 'mana']) {
      const value = settings[`${kind}Threshold`] ?? (kind === 'hp' ? 35 : 20);
      document.querySelector(`#${kind}-threshold`).value = value;
      document.querySelector(`#${kind}-threshold-value`).textContent = `${value}%`;
    }
  }
  renderCrafting(character) {
    if (!character) return;
    const signature = `${character.classId}:${character.status}:${Object.entries(character.resources).sort(([a], [b]) => a.localeCompare(b)).map(([id, amount]) => `${id}:${amount}`).join(',')}`;
    if (signature === this.craftingSignature) return;
    this.craftingSignature = signature;
    const names = Object.fromEntries(Object.entries(RESOURCE_CATALOG).map(([id, item]) => [id, item.name]));
    document.querySelector('#crafting-list').innerHTML = Object.values(RECIPES).map((recipe) => {
      const costs = Object.entries(recipe.materials).map(([id, amount]) => `<span class="material-chip ${(character.resources[id] ?? 0) >= amount ? 'enough' : 'missing'}">${names[id] ?? id} ${character.resources[id] ?? 0}/${amount}</span>`).join('');
      const classAllowed = !recipe.allowedClasses || recipe.allowedClasses.includes(character.classId);
      const canCraft = classAllowed && Object.entries(recipe.materials).every(([id, amount]) => (character.resources[id] ?? 0) >= amount) && character.status === 'alive';
      return `<article class="recipe-card"><div class="recipe-art" style="--weapon-color:#${recipe.color.toString(16).padStart(6, '0')}">⚔</div><div class="recipe-info"><span class="inventory-item-type">ARMA · DANO BASE ${recipe.damage}</span><b>${recipe.name}</b><div class="material-costs">${costs}</div><small>${classAllowed ? 'Qualidade, formato e bônus variam a cada criação.' : 'Disponível para a classe Guerreiro.'}</small></div><button class="craft-recipe-button" data-recipe="${recipe.id}" ${canCraft ? '' : 'disabled'}>${canCraft ? 'CRIAR' : classAllowed ? 'FALTAM ITENS' : 'OUTRA CLASSE'}</button></article>`;
    }).join('');
  }
  renderParty(party) {
    const summary = document.querySelector('#party-current');
    const share = document.querySelector('#share-party');
    if (!party) {
      summary.innerHTML = '<span>◇</span><b>Você ainda não está em um grupo</b>';
      share.disabled = true;
      document.querySelector('#party-members').replaceChildren();
      this.renderDungeons(this.getCharacter(), null);
      return;
    }
    summary.innerHTML = `<span>♟</span><b>Grupo ativo</b><code>${party.id.slice(0, 8)}</code>`;
    share.disabled = false;
    document.querySelector('#party-members').innerHTML = `<span class="party-member-count">${party.members.length} AVENTUREIRO(S)</span>${party.members.map((member, index) => `<div class="party-member"><span>${index === 0 ? '♛' : '♟'}</span><b>${this.escapeHtml(member.name)}</b><small>${index === 0 ? 'LÍDER' : 'ALIADO'}</small></div>`).join('')}`;
    this.renderDungeons(this.getCharacter(), party);
  }
  showPartyInvite(link) {
    const input = document.querySelector('#party-invite-link');
    input.value = link;
    this.toggleModal('party-modal', true);
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }
  levelUp(level) {
    const element = document.querySelector('#level-up-toast');
    element.querySelector('b').textContent = `NÍVEL ${level}`;
    element.classList.remove('hidden');
    element.classList.remove('level-up-enter');
    void element.offsetWidth;
    element.classList.add('level-up-enter');
    clearTimeout(this.levelUpTimeout);
    this.levelUpTimeout = setTimeout(() => element.classList.add('hidden'), 3000);
  }
  setDungeonStatus(message) { document.querySelector('#dungeon-status').textContent = message; }
  setServerClock(clock) {
    if (!clock) return;
    const hour = String(clock.hour).padStart(2, '0');
    const minute = String(clock.minute).padStart(2, '0');
    document.querySelector('#clock-time').textContent = `${hour}:${minute}`;
    document.querySelector('#clock-icon').textContent = clock.isNight ? '☾' : '☀';
    document.querySelector('#clock-label').textContent = clock.isMonsterSurge ? 'PERIGO · AMANHECER' : clock.isNight ? 'NOITE · SERVIDOR' : 'DIA · SERVIDOR';
    document.querySelector('.server-clock').classList.toggle('night', clock.isNight);
    document.querySelector('.server-clock').classList.toggle('monster-surge', clock.isMonsterSurge);
  }
  setDungeonProgress(message, enemies = 0, visible = true) {
    const panel = document.querySelector('#dungeon-progress');
    panel.classList.toggle('hidden', !visible);
    document.querySelector('#dungeon-progress-label').textContent = message;
    document.querySelector('#dungeon-progress-enemies').textContent = `${enemies} INIMIGO(S)`;
  }
  clearItemSelection() { this.selectedItems.clear(); this.inventorySignature = null; this.updateSelectedCount(); }
  escapeHtml(value) { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
  setModalVisible(visible) { document.querySelector('#character-modal').classList.toggle('hidden', !visible); }
  setGameReady() { document.querySelector('#game-loading')?.classList.add('hidden'); }
  showStartupError(message) {
    const panel = document.querySelector('#game-loading');
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.classList.add('failed');
    panel.innerHTML = '<span class="loading-rune">!</span><b>O REINO NÃO CONSEGUIU INICIAR</b><small></small><button class="reload-game" type="button">RECARREGAR O JOGO</button>';
    panel.querySelector('small').textContent = String(message || 'Erro inesperado ao iniciar o jogo.').slice(0, 220);
    panel.querySelector('button').addEventListener('click', () => location.reload());
  }
  setDead() { document.querySelector('#death-overlay').classList.remove('hidden'); }
  setAlive() { document.querySelector('#death-overlay').classList.add('hidden'); }
  clearLog() { document.querySelector('#event-log').replaceChildren(); }
  render(character, biome, loadedChunks = 0, skillStates = this.lastSkillStates, chunks = this.lastChunks) {
    if (!character) return;
    SkillProgression.initialize(character);
    this.lastChunks = chunks ?? this.lastChunks;
    this.lastSkillStates = skillStates ?? this.lastSkillStates;
    const frameNow = globalThis.performance?.now?.() ?? Date.now();
    const data = CLASS_CATALOG[character.classId];
    const derived = StatsSystem.derived(character);
    const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    set('hero-name', character.name); set('hero-class', data.name.toLocaleUpperCase('pt-BR'));
    set('avatar-icon', data.icon); set('level-badge', `NV. ${character.level}`);
    set('xp-label', `${character.xp} / ${character.xpToNext}`);
    const xpWidth = `${Math.min(100, character.xp / character.xpToNext * 100)}%`;
    if (document.querySelector('#xp-fill').style.width !== xpWidth) document.querySelector('#xp-fill').style.width = xpWidth;
    const currentLife = character.currentLife ?? derived.maxLife;
    const currentMana = character.currentMana ?? derived.maxMana;
    const safe = BiomeSystem.isSafe(character.position.x, character.position.y);
    document.querySelector('#safe-zone-badge').classList.toggle('hidden', !safe);
    set('health-label', `${Math.ceil(currentLife)} / ${derived.maxLife}`); set('state-label', character.status !== 'alive' ? 'ENCERRADO' : character.autoEnabled === false ? 'PAUSADO' : 'EXPLORANDO');
    set('hp-hud-label', `${Math.ceil(currentLife)} / ${derived.maxLife}`);
    set('mana-hud-label', `${Math.ceil(currentMana)} / ${derived.maxMana}`);
    const hpWidth = `${Math.max(0, Math.min(100, currentLife / derived.maxLife * 100))}%`;
    const manaWidth = `${Math.max(0, Math.min(100, currentMana / derived.maxMana * 100))}%`;
    if (document.querySelector('#hp-fill').style.width !== hpWidth) document.querySelector('#hp-fill').style.width = hpWidth;
    if (document.querySelector('#mana-fill').style.width !== manaWidth) document.querySelector('#mana-fill').style.width = manaWidth;
    const cooldowns = character.potionCooldowns ?? {};
    this.renderPotion('hp', cooldowns.hp ?? 0, currentLife, derived.maxLife);
    this.renderPotion('mana', cooldowns.mana ?? 0, currentMana, derived.maxMana);
    this.setAutoEnabled(character.autoEnabled !== false);
    if (!document.querySelector('#crafting-modal').classList.contains('hidden')) this.renderCrafting(character);
    this.updateAutoSettingsStatus(character);
    set('points-label', `${character.unspentPoints} PONTOS`);
    const attributes = { ...character.attributes, physicalDefense: derived.physicalDefense, magicDefense: derived.magicDefense, accuracy: derived.accuracy, evasion: derived.evasion };
    const attributeSignature = `${character.status}:${character.unspentPoints}:${Object.values(attributes).join(',')}`;
    if (attributeSignature !== this.attributeSignature) document.querySelector('#attribute-list').innerHTML = Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => {
      const primary = PRIMARY_ATTRIBUTES.includes(key);
      const value = primary ? character.attributes[key] : attributes[key];
      return `<div class="attribute-item" title="${ATTRIBUTE_HELP[key]}"><span>${label}</span><b>${value}</b>${primary ? `<button data-attribute="${key}" aria-label="Aumentar ${label}" ${character.unspentPoints < 1 || character.status !== 'alive' ? 'disabled' : ''}>+</button>` : ''}</div>`;
    }).join('');
    if (attributeSignature !== this.attributeSignature) this.attributeSignature = attributeSignature;
    const resourceSignature = Object.keys(RESOURCE_CATALOG).map((id) => `${id}:${character.resources[id] ?? 0}`).join('|');
    if (resourceSignature !== this.resourceSignature) {
      document.querySelector('#resource-list').innerHTML = Object.keys(RESOURCE_CATALOG).map((id) => `<div class="resource-cell" title="${RESOURCE_CATALOG[id].name}"><span class="res-icon">${RESOURCE_CATALOG[id].icon}</span><span>${RESOURCE_CATALOG[id].name}</span><b>${character.resources[id] ?? 0}</b></div>`).join('');
      this.resourceSignature = resourceSignature;
    }
    const equipped = character.weapons.find((weapon) => weapon.id === character.equippedWeaponId);
    set('weapon-name', equipped?.name ?? 'Sem arma'); set('weapon-detail', equipped ? `Dano +${equipped.damage} · material vivo` : data.weapon);
    set('weapon-icon', equipped ? '⚔' : data.icon); set('equipped-tag', equipped ? 'EQUIPADA' : '—');
    const craft = document.querySelector('#craft-button');
    const craftableCount = Object.keys(RECIPES).filter((recipeId) => CraftingSystem.canCraft(character, recipeId)).length;
    craft.disabled = character.status !== 'alive';
    document.querySelector('#craft-recipe').textContent = craftableCount ? `${craftableCount} receita(s) disponível(is) · Abrir oficina` : 'Ver receitas e materiais necessários';
    set('biome-label', biome.name.toLocaleUpperCase('pt-BR'));
    set('zone-label', biome.zone); set('coords-label', `${Math.floor(character.position.x)}, ${Math.floor(character.position.y)}`);
    set('save-status', 'SALVO'); set('inventory-count', `${Object.values(character.resources).reduce((sum, amount) => sum + amount, 0) + character.weapons.length} ITENS`);
    if (loadedChunks) document.querySelector('#zone-label').title = `${loadedChunks} chunks ativos`;
    this.renderSkills(character, this.lastSkillStates);
    const mapSignature = `${Math.floor(character.position.x / 64)},${Math.floor(character.position.y / 64)}:${this.lastChunks.map((chunk) => chunk.key).join('|')}`;
    if (frameNow - this.lastMiniMapDraw >= 1000 || mapSignature !== this.miniMapSignature) {
      this.mapRenderer.drawMinimap(document.querySelector('#minimap'), character, this.lastChunks);
      this.lastMiniMapDraw = frameNow;
      this.miniMapSignature = mapSignature;
    }
    set('mini-coords', `${Math.floor(character.position.x)} · ${Math.floor(character.position.y)}`);
    if (!document.querySelector('#world-map-modal').classList.contains('hidden') && frameNow - this.lastWorldMapDraw >= 1000) {
      this.mapRenderer.drawWorld(document.querySelector('#world-map'), character);
      this.lastWorldMapDraw = frameNow;
    }
    if (!document.querySelector('#inventory-modal').classList.contains('hidden')) this.renderInventory(character);
    this.lastCharacter = character;
  }
  updateAutoSettingsStatus(character) {
    const settings = character.autoPotion ?? {};
    document.querySelector('#open-auto-potions').classList.toggle('active', Boolean(settings.hpEnabled || settings.manaEnabled));
  }
  renderPotion(kind, readyAt, current, maximum) {
    const now = this.getSceneTime?.() ?? 0;
    const remaining = Math.max(0, Math.ceil((readyAt - now) / 1000));
    const button = document.querySelector(kind === 'hp' ? '#use-hp-potion' : '#use-mana-potion');
    const timer = document.querySelector(kind === 'hp' ? '#hp-potion-timer' : '#mana-potion-timer');
    const full = current >= maximum;
    button.disabled = remaining > 0 || full;
    timer.textContent = remaining ? `${remaining}s` : full ? 'CHEIA' : '∞';
  }
  setSceneTimeProvider(provider) { this.getSceneTime = provider; }
  setAutoEnabled(enabled) {
    const button = document.querySelector('#toggle-auto');
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Pausar automação' : 'Retomar automação');
    document.querySelector('#auto-icon').textContent = enabled ? 'Ⅱ' : '▶';
    document.querySelector('#auto-label').textContent = enabled ? 'AUTO ON' : 'PAUSADO';
  }
  renderInventory(character, force = false) {
    if (!character) return;
    const root = document.querySelector('#inventory-content');
    const signature = `${this.inventoryTab}:${this.inventorySorted}:${[...this.selectedItems].join('|')}:${Object.entries(character.resources).sort(([a], [b]) => a.localeCompare(b)).map(([id, amount]) => `${id}:${amount}`).join(',')}:${character.weapons.map((weapon) => `${weapon.id}:${weapon.damage}:${weapon.quality}`).join('|')}:${JSON.stringify(character.equipment ?? {})}`;
    if (!force && signature === this.inventorySignature) return;
    this.inventorySignature = signature;
    EquipmentSystem.initialize(character);
    this.renderEquipmentSlots(character);
    const resources = Object.entries(RESOURCE_CATALOG).filter(([id]) => (character.resources[id] ?? 0) > 0).map(([id, entry]) => ({ key: `resource:${id}`, id, name: entry.name, icon: entry.icon, amount: character.resources[id], detail: 'Material coletado', type: 'MATERIAL', kind: 'resource' }));
    let entries = [];
    if (this.inventoryTab === 'collected') entries = resources;
    if (this.inventoryTab === 'weapons') entries = character.weapons.map((weapon) => ({ key: `weapon:${weapon.id}`, id: weapon.id, name: `${weapon.quality ?? 'Comum'} ${weapon.name}`.trim(), icon: '⚔', amount: 1, detail: `Dano ${weapon.damage} · ${(weapon.affixes ?? []).map((affix) => `${affix.name} +${affix.value}${affix.unit}`).join(' · ') || 'sem afixos'}`, type: weapon.quality?.toUpperCase() ?? 'ARMA', kind: 'weapon', weapon }));
    if (this.inventoryTab === 'gear') entries = EQUIPMENT_SLOTS.filter((slot) => slot.id !== 'mainHand').map((slot) => ({ key: `slot:${slot.id}`, id: slot.id, name: slot.name, icon: slot.icon, amount: 0, detail: 'Espaço reservado para próximos equipamentos.', type: 'SLOT VAZIO', kind: 'placeholder' }));
    if (this.inventoryTab === 'consumables') entries = [{ name: 'Poção de vida', icon: '🧪', amount: '∞', detail: 'Restaura 40% da vida máxima · recarga 5 s', type: 'INFINITA' }, { name: 'Poção de mana', icon: '⚗', amount: '∞', detail: 'Restaura 50% da mana máxima · recarga 5 s', type: 'INFINITA' }];
    if (this.inventoryTab === 'special') entries = [];
    if (this.inventorySorted) entries.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (!entries.length) root.innerHTML = '<div class="inventory-empty"><span>◇</span><b>Nenhum item nesta aba</b><small>Continue explorando para encontrar recursos e equipamentos.</small></div>';
    else root.innerHTML = `<div class="inventory-grid">${entries.map((item) => {
      const selected = this.selectedItems.has(item.key);
      const equipped = item.kind === 'weapon' && Object.values(character.equipment).includes(item.id);
      const selector = item.kind !== 'placeholder' && item.key ? `<label class="item-select"><input type="checkbox" data-select-item="${item.key}" ${selected ? 'checked' : ''}><span></span></label>` : '';
      const actions = item.kind === 'weapon' ? `<div class="item-card-actions"><button data-compare-item="${item.id}">⇄ COMPARAR</button><button data-equip-item="${item.id}" ${equipped ? 'disabled' : ''}>${equipped ? 'EQUIPADA' : 'EQUIPAR'}</button></div>` : '';
      return `<article class="inventory-item ${selected ? 'selected' : ''}">${selector}<div class="inventory-item-icon">${item.icon}</div><span class="inventory-item-type">${item.type}</span><b>${item.name}</b><small>${item.detail}</small><strong>${item.amount === '∞' ? '∞' : item.kind === 'placeholder' ? '—' : `× ${item.amount}`}</strong>${actions}</article>`;
    }).join('')}</div>`;
    document.querySelector('#inventory-summary').textContent = `${entries.length} tipo(s) de item · ${this.inventorySorted ? 'ordem alfabética' : 'ordem de coleta'}`;
    this.updateSelectedCount();
  }
  renderEquipmentSlots(character) {
    const slots = EQUIPMENT_SLOTS.map((slot) => {
      const itemId = character.equipment[slot.id];
      const item = character.weapons.find((weapon) => weapon.id === itemId);
      return `<div class="equipment-slot ${item ? 'occupied' : 'empty'}"><span>${item ? '⚔' : slot.icon}</span><small>${slot.name}</small><b>${item?.name ?? 'Vazio'}</b>${item ? `<button data-unequip-slot="${slot.id}" title="Desequipar">×</button>` : ''}</div>`;
    }).join('');
    const root = document.querySelector('#equipment-slots');
    root.innerHTML = slots;
    root.querySelectorAll('[data-unequip-slot]').forEach((button) => button.addEventListener('click', () => {
      if (EquipmentSystem.unequip(character, button.dataset.unequipSlot)) this.actions.onEquipItem?.(null);
    }));
  }
  toggleItemSelection(key, selected) { if (selected) this.selectedItems.add(key); else this.selectedItems.delete(key); this.updateSelectedCount(); }
  updateSelectedCount() {
    document.querySelector('#selected-item-count').textContent = this.selectedItems.size;
    document.querySelector('#salvage-selected').disabled = this.selectedItems.size === 0;
  }
  openItemComparison(itemId) {
    const character = this.getCharacter();
    const item = character.weapons.find((weapon) => weapon.id === itemId);
    if (!item) return;
    this.compareItemId = itemId;
    const comparison = EquipmentSystem.compare(character, item);
    const lines = [{ name: 'Dano base', current: comparison.damageCurrent, candidate: comparison.damageCandidate, delta: comparison.damageDelta }, ...comparison.differences.map((entry) => ({ name: this.statName(entry.stat), ...entry }))];
    const currentName = comparison.current?.name ?? 'Nenhum item equipado';
    document.querySelector('#compare-content').innerHTML = `<div class="compare-columns"><article class="compare-item current"><span>EQUIPADO</span><b>${currentName}</b></article><span class="compare-vs">VS</span><article class="compare-item candidate"><span>NOVO ITEM · ${item.quality}</span><b>${item.name}</b></article></div><table class="compare-table"><thead><tr><th>ATRIBUTO</th><th>ATUAL</th><th>ITEM</th><th>DIFERENÇA</th></tr></thead><tbody>${lines.map((row) => `<tr><th>${row.name}</th><td>${row.current}</td><td>${row.candidate}</td><td class="${row.delta > 0 ? 'positive' : row.delta < 0 ? 'negative' : ''}">${row.delta > 0 ? '+' : ''}${row.delta}</td></tr>`).join('')}</tbody></table><div class="compare-affixes"><b>AFIXOS</b><span>${item.affixes?.length ? item.affixes.map((affix) => `${affix.name} +${affix.value}${affix.unit} ${this.statName(affix.stat)}`).join(' · ') : 'Sem atributos adicionais'}</span></div>`;
    this.toggleModal('item-compare-modal', true);
  }
  statName(stat) { return ({ criticalChance: 'Chance crítica', criticalDamage: 'Dano crítico', magicDamage: 'Dano mágico', accuracy: 'Precisão', attackSpeed: 'Velocidade', armorPenetration: 'Perfuração', lifeSteal: 'Roubo de vida', physicalDefense: 'Defesa física', magicDefense: 'Defesa mágica', evasion: 'Esquiva', maxLife: 'Vida máxima', maxMana: 'Mana máxima', manaRegeneration: 'Regeneração de mana' })[stat] ?? stat; }
  renderDungeons(character, party = null) {
    if (!character) return;
    const filter = document.querySelector('#dungeon-level-filter').value;
    const mechanic = document.querySelector('#dungeon-mechanic-filter').value;
    const inRange = (dungeon) => filter === 'all' || (filter === '1-15' && dungeon.level <= 15) || (filter === '15-20' && dungeon.level >= 15 && dungeon.level <= 20) || (filter === '20-30' && dungeon.level >= 20 && dungeon.level <= 30);
    const visible = DUNGEONS.filter((dungeon) => inRange(dungeon) && (mechanic === 'all' || dungeon.mechanics?.includes(mechanic)));
    const future = [{ id: 'rootCaverns', name: 'Galerias das Raízes', level: 8, icon: '♧', mechanics: ['swarm'] }, { id: 'orcStronghold', name: 'Fortaleza Orc', level: 16, icon: '♜', mechanics: ['elite'] }, { id: 'wraithSanctum', name: 'Santuário dos Espectros', level: 24, icon: '◌', mechanics: ['flight'] }].filter((dungeon) => inRange(dungeon) && (mechanic === 'all' || dungeon.mechanics.includes(mechanic)));
    document.querySelector('#dungeon-list').innerHTML = [...visible.map((dungeon) => {
      const levelOk = character.level >= dungeon.level;
      const partyOk = party?.members?.length === 4;
      return `<article class="dungeon-card"><div class="dungeon-icon">${dungeon.icon}</div><div class="dungeon-main"><b>${dungeon.name}</b><span>NÍVEL ${dungeon.level}+ · SOLO OU GRUPO 4/4</span><small>3 etapas · Enxame de morcegos · Elite final Vesper</small><small>Mecânicas: grito sônico, voo em mergulho e invocação de lacaios.</small></div><div class="dungeon-entry-actions"><button data-enter-dungeon="${dungeon.id}" data-mode="solo" ${!levelOk ? 'disabled' : ''}>${!levelOk ? `NV. ${dungeon.level} NECESSÁRIO` : 'SOLO'}</button><button data-enter-dungeon="${dungeon.id}" data-mode="party" ${!levelOk || !partyOk ? 'disabled' : ''}>${partyOk ? 'GRUPO 4/4' : 'GRUPO 4/4'}</button></div></article>`;
    }), ...future.map((dungeon) => `<article class="dungeon-card locked"><div class="dungeon-icon">${dungeon.icon}</div><div class="dungeon-main"><b>${dungeon.name}</b><span>NÍVEL ${dungeon.level}+ · EM PREPARAÇÃO</span><small>Uma nova expedição será adicionada em breve.</small></div><button disabled>EM BREVE</button></article>`)].join('');
    document.querySelector('#dungeon-status').textContent = party ? `Grupo atual: ${party.members.length}/4 · Dungeon exige solo ou grupo completo de quatro.` : 'Você pode entrar solo ou formar um grupo de quatro aventureiros.';
  }
  renderSkills(character, skillStates = []) {
    const catalog = SkillProgression.catalog(character.classId);
    const stateById = new Map(skillStates.map((skill) => [skill.id, skill]));
    const descriptions = Object.fromEntries(catalog.map((skill) => [skill.id, skill.description]));
    const icons = Object.fromEntries(catalog.map((skill) => [skill.id, skill.icon ?? '✦']));
    const hud = document.querySelector('#skill-hud');
    const treeSignature = `${character.classId}:${character.status}:${character.skillPoints}:${catalog.map((skill) => SkillProgression.rank(character, skill.id)).join(',')}`;
    const refreshTree = treeSignature !== this.skillTreeSignature;
    if (!catalog.length) {
      const placeholder = '<div class="skill-hud-placeholder">HABILIDADES DA CLASSE <b>EM BREVE</b></div>';
      if (hud.innerHTML !== placeholder) hud.innerHTML = placeholder;
      if (refreshTree) document.querySelector('#skill-tree').innerHTML = '<div class="skill-coming-soon"><span>✧</span><b>Esta árvore está sendo preparada</b><small>As habilidades dessa classe serão configuráveis na próxima etapa.</small></div>';
    } else {
      const hudMarkup = catalog.map((skill) => {
        const state = stateById.get(skill.id) ?? skill;
        const remaining = Math.ceil((state.remaining ?? 0) / 1000);
        const unaffordable = character.currentMana < (state.manaCost ?? skill.manaCost);
        return `<button class="skill-slot ${remaining || unaffordable ? 'cooldown' : 'ready'}" data-skill-detail="${skill.id}" title="${skill.name} · Nível ${state.rank ?? SkillProgression.rank(character, skill.id)} · ${descriptions[skill.id]} · Custo ${state.manaCost ?? skill.manaCost} mana"><span class="skill-slot-icon">${icons[skill.id] ?? '✦'}</span><span class="skill-slot-copy"><b>${skill.name}</b><small>NV.${state.rank ?? SkillProgression.rank(character, skill.id)} · ${remaining ? `${remaining}s` : unaffordable ? `${state.manaCost ?? skill.manaCost} MP` : 'PRONTA'}</small></span><span class="skill-ready-dot"></span></button>`;
      }).join('');
      if (hudMarkup !== this.skillHudMarkup) { hud.innerHTML = hudMarkup; this.skillHudMarkup = hudMarkup; }
      if (refreshTree) document.querySelector('#skill-tree').innerHTML = catalog.map((skill, index) => {
        const rank = SkillProgression.rank(character, skill.id);
        const state = stateById.get(skill.id) ?? SkillProgression.effective(character, skill);
        const next = SkillProgression.effective(character, skill, Math.min(10, rank + 1));
        const remaining = Math.ceil((state.remaining ?? 0) / 1000);
        const derived = StatsSystem.derived(character);
        const filled = Array.from({ length: 10 }, (_, slot) => `<i class="rank-pip ${slot < rank ? 'filled' : ''}"></i>`).join('');
        const disabled = rank >= 10 || character.skillPoints < 1 || character.status !== 'alive';
        const detail = skill.kind === 'areaDamage'
          ? `Dano ${Math.round(derived.damage * state.multiplier)} → ${Math.round(derived.damage * next.multiplier)} · raio ${state.radius}`
          : skill.kind === 'healTaunt'
            ? `Cura ${Math.round(derived.maxLife * state.healRatio)} → ${Math.round(derived.maxLife * next.healRatio)} PV · provoca 10s`
            : skill.kind === 'defenseBuff'
              ? `Defesa +${Math.round(state.defenseRatio * 100)}% → +${Math.round(next.defenseRatio * 100)}% · ${state.duration / 1000}s`
              : `Raio ${state.radius} → ${next.radius} · provoca 10s`;
        return `<article class="skill-node"><div class="skill-node-connector">${index === 0 ? '<span>✦</span>' : '<span>↓</span>'}</div><div class="skill-node-icon">${icons[skill.id] ?? '✦'}</div><div class="skill-node-main"><div class="skill-node-title"><b>${skill.name}</b><span>NÍVEL ${rank} / 10</span></div><p>${descriptions[skill.id]}</p><div class="skill-detail-chips"><span>✧ ${state.manaCost} MANA</span><span>◷ ${(state.cooldown / 1000).toFixed(1)}s recarga</span></div><div class="rank-track">${filled}</div><small>${detail}${remaining ? ` · Recarga restante ${remaining}s` : ''}</small></div><button class="upgrade-skill" data-skill-id="${skill.id}" ${disabled ? 'disabled' : ''}>${rank >= 10 ? 'MÁX.' : '+1'}<small>${rank >= 10 ? 'COMPLETO' : '1 PONTO'}</small></button></article>`;
      }).join('');
    }
    this.skillTreeSignature = treeSignature;
    document.querySelector('#skill-points-top').textContent = character.skillPoints;
    document.querySelector('#skill-points-modal').textContent = character.skillPoints;
  }
  log(message, tone = 'normal') {
    const container = document.querySelector('#event-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    entry.innerHTML = `<time>${time}</time><span class="log-mark">${tone === 'good' ? '✦' : tone === 'danger' ? '×' : '·'}</span><span></span>`;
    entry.lastElementChild.textContent = message;
    container.prepend(entry);
    while (container.children.length > 5) container.lastElementChild.remove();
  }
  notice(message, tone = '') {
    const container = document.querySelector('#floating-notices');
    const element = document.createElement('div'); element.className = `notice ${tone}`; element.textContent = message;
    container.append(element); setTimeout(() => element.remove(), 2100);
  }
  setSaving() { document.querySelector('#save-status').textContent = 'SALVANDO…'; }
}
