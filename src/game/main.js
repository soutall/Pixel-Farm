import * as Phaser from 'phaser';
import { GameplayScene } from './scenes/GameplayScene.js';
import { SaveRepository } from './save/SaveRepository.js';
import { createCharacter } from './classes/classCatalog.js';
import { StatsSystem } from './stats/StatsSystem.js';
import { CraftingSystem } from './crafting/CraftingSystem.js';
import { UIController } from './ui/UIController.js';
import { BiomeSystem } from './world/BiomeSystem.js';
import { AudioSystem } from './combat/AudioSystem.js';
import { SkillProgression } from './skills/SkillProgression.js';
import { PartyClient } from './chat/PartyClient.js';
import { MultiplayerClient } from './chat/MultiplayerClient.js';
import { EquipmentSystem } from './inventory/EquipmentSystem.js';
import { DeathSystem } from './combat/DeathSystem.js';
import { normalizeProfile } from './save/ProfileNormalizer.js';

let activeUI;

const repository = new SaveRepository();
const audio = new AudioSystem();
const partyClient = new PartyClient();
document.addEventListener('pointerdown', () => { audio.unlock(); audio.startAmbient(); }, { once: true });
let profile = normalizeProfile(await repository.load(), createSeed());
profile.seed ||= createSeed();
profile.history ||= [];
if (profile.character?.status === 'dead') {
  DeathSystem.respawnInTown(profile.character, 'Retorno automático após atualização do jogo');
  profile.character.respawnedFromLegacySave = true;
}
let game;
let scene;
const multiplayer = new MultiplayerClient({
  onWelcome: (message) => {
    if (message.character) {
      if (profile.character) Object.assign(profile.character, message.character);
      else profile.character = message.character;
    }
    if (message.worldSeed) profile.seed = message.worldSeed;
    (scene ?? game?.scene.getScene('GameplayScene'))?.setMultiplayerWelcome(message);
  },
  onState: (state) => {
    if (state.self) {
      if (profile.character) Object.assign(profile.character, state.self);
      else profile.character = state.self;
    }
    (scene ?? game?.scene.getScene('GameplayScene'))?.setAuthoritativeState(state);
    const indicator = document.querySelector('#multiplayer-status');
    if (indicator) indicator.textContent = `${state.players?.length ?? 0} NO MUNDO`;
  },
  onStatus: (status) => {
    const indicator = document.querySelector('#multiplayer-status');
    if (indicator) indicator.textContent = status === 'online' ? 'MULTIPLAYER ONLINE' : status === 'connecting' ? 'CONECTANDO…' : 'OFFLINE';
  }
});
let saveTimer;
let gameReady = false;
const startupTimeout = setTimeout(() => {
  if (!gameReady) activeUI?.showStartupError('O Phaser não concluiu a inicialização. Verifique conexão e recarregue a página.');
}, 12000);
window.addEventListener('farm-game-ready', () => {
  gameReady = true;
  clearTimeout(startupTimeout);
});
window.addEventListener('error', (event) => {
  if (!gameReady) activeUI?.showStartupError(event.message || 'Falha ao iniciar a cena do jogo.');
});
window.addEventListener('unhandledrejection', (event) => {
  if (!gameReady) activeUI?.showStartupError(event.reason?.message ?? event.reason ?? 'Falha ao carregar os dados do jogo.');
});

const save = async () => {
  document.querySelector('#save-status').textContent = 'SALVANDO…';
  await repository.save(profile);
  document.querySelector('#save-status').textContent = 'SALVO';
};
const ui = new UIController({
  getCharacter: () => profile.character,
  onCreateCharacter: (name, classId) => {
    audio.unlock();
    profile.character = createCharacter(name, classId, profile.seed);
    ui.clearLog(); ui.setModalVisible(false); ui.setAlive();
    scene?.startCharacter(profile.character);
    ui.render(profile.character, BiomeSystem.at(0, 0));
    joinPendingParty(profile.character.name);
    save();
  },
  onAllocate: (attribute) => {
    if (multiplayer) { if (!multiplayer.sendAction('allocate', { attribute })) ui.notice('Aguardando conexão com o servidor.', 'danger'); return; }
    if (StatsSystem.allocate(profile.character, attribute)) { ui.render(profile.character, BiomeSystem.at(profile.character.position.x, profile.character.position.y)); save(); }
  },
  onCraft: (recipeId) => {
    if (multiplayer) { if (!multiplayer.sendAction('craft', { recipeId })) ui.notice('Aguardando conexão com o servidor.', 'danger'); return; }
    const weapon = CraftingSystem.craft(profile.character, recipeId);
    if (!weapon) return;
    const weaponStats = StatsSystem.derived(profile.character);
    profile.character.currentLife = Math.min(profile.character.currentLife ?? weaponStats.maxLife, weaponStats.maxLife);
    profile.character.currentMana = Math.min(profile.character.currentMana ?? weaponStats.maxMana, weaponStats.maxMana);
    ui.log(`${weapon.quality} ${weapon.name} criada e equipada${weapon.affixes.length ? ` · ${weapon.affixes.map((affix) => `${affix.name} +${affix.value}${affix.unit}`).join(', ')}` : ''}!`, 'good'); ui.notice('ARMA CRIADA · EQUIPADA', 'good');
    audio.playUi('upgrade');
    ui.render(profile.character, BiomeSystem.at(profile.character.position.x, profile.character.position.y)); save();
  },
  onDungeonStart: (dungeonId, solo = false) => {
    if (multiplayer) {
      if (!multiplayer.sendAction('enterDungeon', { dungeonId, solo })) ui.notice('Aguardando conexão com o servidor.', 'danger');
      ui.toggleModal('dungeons-modal', false);
      return;
    }
    const result = scene?.enterDungeon(dungeonId, solo ? null : partyClient.party);
    if (!result?.allowed) { ui.notice(result?.reason ?? 'Não foi possível entrar na dungeon.', 'danger'); return; }
    ui.toggleModal('dungeons-modal', false);
    ui.notice(result.run.solo ? 'DUNGEON SOLO INICIADA' : 'DUNGEON EM GRUPO INICIADA', 'good');
  },
  onEquipItem: (itemId) => {
    if (multiplayer) { if (!multiplayer.sendAction('equip', { itemId })) ui.notice('Aguardando conexão com o servidor.', 'danger'); return; }
    const character = profile.character;
    const changed = itemId ? EquipmentSystem.equip(character, itemId) : true;
    if (!changed) return;
    if (!itemId) EquipmentSystem.initialize(character);
    const stats = StatsSystem.derived(character);
    character.currentLife = Math.min(character.currentLife ?? stats.maxLife, stats.maxLife);
    character.currentMana = Math.min(character.currentMana ?? stats.maxMana, stats.maxMana);
    ui.log(itemId ? 'Equipamento alterado.' : 'Equipamento atualizado.', 'good');
    ui.render(character, BiomeSystem.at(character.position.x, character.position.y)); audio.playUi('upgrade'); save();
  },
  onSalvage: (keys) => {
    if (multiplayer) { if (!multiplayer.sendAction('salvage', { keys })) ui.notice('Aguardando conexão com o servidor.', 'danger'); ui.clearItemSelection(); return; }
    const weaponIds = keys.filter((key) => key.startsWith('weapon:')).map((key) => key.slice(7));
    const resourceIds = keys.filter((key) => key.startsWith('resource:')).map((key) => key.slice(9));
    const result = EquipmentSystem.salvage(profile.character, weaponIds, resourceIds);
    ui.clearItemSelection();
    if (result.removed) { ui.log(`${result.removed} item(ns) desmontado(s) em ${result.fragments} fragmentos.`, 'good'); ui.notice(`+${result.fragments} FRAGMENTOS`, 'good'); }
    ui.render(profile.character, BiomeSystem.at(profile.character.position.x, profile.character.position.y)); save();
  },
  onTeleportTown: () => {
    if (!profile.character || profile.character.status !== 'alive') return;
    if (multiplayer) { if (!multiplayer.sendAction('teleportTown')) ui.notice('Aguardando conexão com o servidor.', 'danger'); ui.toggleModal('world-map-modal', false); return; }
    scene?.teleportToTown(); ui.toggleModal('world-map-modal', false); save();
  },
  onUpgradeSkill: (skillId) => {
    if (multiplayer) { if (!multiplayer.sendAction('upgradeSkill', { skillId })) ui.notice('Aguardando conexão com o servidor.', 'danger'); return; }
    if (!SkillProgression.upgrade(profile.character, skillId)) return;
    audio.playUi('upgrade');
    const skill = SkillProgression.catalog(profile.character.classId).find((entry) => entry.id === skillId);
    ui.log(`${skill?.name ?? 'Habilidade'} aprimorada para nível ${profile.character.skillLevels[skillId]}.`, 'good');
    ui.render(profile.character, BiomeSystem.at(profile.character.position.x, profile.character.position.y));
    save();
  },
  onUiSound: (action) => audio.playUi(action),
  onUsePotion: (kind) => {
    if (multiplayer) { if (!multiplayer.sendAction('usePotion', { kind })) ui.notice('Aguardando conexão com o servidor.', 'danger'); return; }
    const used = scene?.usePotion(kind);
    if (used && profile.character) ui.render(profile.character, BiomeSystem.at(profile.character.position.x, profile.character.position.y));
  },
  onPotionSettings: (kind, change) => {
    if (multiplayer) {
      if ('enabled' in change && !multiplayer.sendAction('setAutoPotion', { key: `${kind}Enabled`, value: change.enabled })) ui.notice('Aguardando conexão com o servidor.', 'danger');
      if ('threshold' in change && !multiplayer.sendAction('setAutoPotion', { key: `${kind}Threshold`, value: change.threshold })) ui.notice('Aguardando conexão com o servidor.', 'danger');
      audio.playUi('click');
      return;
    }
    profile.character.autoPotion ??= { hpEnabled: true, manaEnabled: true, hpThreshold: 60, manaThreshold: 35 };
    if ('enabled' in change) profile.character.autoPotion[`${kind}Enabled`] = change.enabled;
    if ('threshold' in change) profile.character.autoPotion[`${kind}Threshold`] = change.threshold;
    ui.updateAutoSettingsStatus(profile.character);
    audio.playUi('click'); save();
  },
  onToggleAuto: () => {
    if (multiplayer) {
      const next = !profile.character?.autoEnabled;
      if (!multiplayer.setAutoEnabled(next)) { ui.notice('Aguardando conexão com o servidor.', 'danger'); return; }
      ui.setAutoEnabled(next);
      return next;
    }
    return scene?.toggleAuto();
  },
  onPartyCreate: async () => {
    try {
      const party = await partyClient.create(profile.character?.name);
      if (!multiplayer.joinParty(party)) ui.notice('Aguardando conexão com o servidor.', 'danger');
      ui.renderParty(party); ui.showPartyInvite(partyClient.getInviteLink());
    }
    catch (error) { ui.notice(error.message, 'danger'); }
  },
  onPartyJoin: async (link) => {
    try {
      const party = await partyClient.join(link, profile.character?.name);
      if (!multiplayer.joinParty(party)) ui.notice('Aguardando conexão com o servidor.', 'danger');
      ui.renderParty(party); ui.notice('VOCÊ ENTROU NO GRUPO', 'good');
    }
    catch (error) { ui.notice(error.message, 'danger'); }
  },
  onPartyShare: async () => {
    const link = partyClient.getInviteLink();
    try {
      if (navigator.share) await navigator.share({ title: 'Convite de grupo · FARM OF PIXEL', text: 'Venha explorar comigo!', url: link });
      else { await navigator.clipboard.writeText(link); ui.notice('LINK COPIADO', 'good'); }
    } catch { ui.showPartyInvite(link); }
  },
  getParty: () => partyClient.party,
  onNewJourney: () => {
    multiplayer.leaveParty();
    partyClient.clear();
    multiplayer.forgetSession();
    if (profile.character?.status === 'alive') {
      profile.history.push({ characterId: profile.character.id, name: profile.character.name, classId: profile.character.classId, cause: 'Jornada encerrada pelo jogador', level: profile.character.level, endedAt: Date.now() });
    } else if (profile.character?.deathHistory?.length) {
      profile.history.push(...profile.character.deathHistory);
    }
    profile.character = null;
    profile.seed = createSeed();
    scene?.startCharacter(null);
    ui.setAlive(); ui.setModalVisible(true); save();
  }
});
activeUI = ui;

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#425c3e',
  antialias: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  render: { pixelArt: false, roundPixels: false },
  scene: [new GameplayScene({ getCharacter: () => profile.character, ui, save, audio, multiplayer })]
};
game = new Phaser.Game(gameConfig);
window.__FARM_OF_PIXEL__ = { game, multiplayer, get scene() { return scene; } };
ui.setSceneTimeProvider(() => scene?.time.now ?? 0);
ui.renderParty(null);
game.events.once('ready', () => { scene = game.scene.getScene('GameplayScene'); });
// Phaser inicia as cenas no mesmo ciclo; resolve a referência após a criação do canvas.
const sceneLink = setInterval(() => {
  if (game.scene.isActive('GameplayScene')) { scene = game.scene.getScene('GameplayScene'); clearInterval(sceneLink); }
}, 100);

if (profile.character?.status === 'alive') {
  ui.setModalVisible(false);
  ui.render(profile.character, BiomeSystem.at(profile.character.position.x, profile.character.position.y));
} else {
  ui.setModalVisible(true);
  if (profile.character?.status === 'dead') ui.log(`${profile.character.name} está no histórico. Uma nova vida começa no centro.`);
}
document.querySelector('#seed-label').textContent = profile.seed.slice(0, 8).toUpperCase();
const inviteUrl = new URL(location.href);
if (inviteUrl.searchParams.has('party') && inviteUrl.searchParams.has('invite') && profile.character?.status === 'alive') joinPendingParty(profile.character.name);
saveTimer = setInterval(save, 12000);
window.addEventListener('beforeunload', () => { clearInterval(saveTimer); save(); });

function createSeed() {
  const bytes = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(bytes);
  return `${Date.now().toString(36)}-${(bytes[0] ?? Math.floor(Math.random() * 0xffffffff)).toString(36)}`;
}

function joinPendingParty(name) {
  const url = new URL(location.href);
  if (!url.searchParams.has('party') || !url.searchParams.has('invite')) return;
  partyClient.join(location.href, name).then((party) => {
    multiplayer.joinParty(party);
    ui.renderParty(party); ui.toggleModal('party-modal', true); ui.notice('VOCÊ ENTROU NO GRUPO', 'good');
  }).catch((error) => ui.notice(error.message, 'danger'));
}
