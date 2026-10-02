export const WARRIOR_SKILLS = [
  { id: 'warriorWhirlwind', name: 'Ciclone de Aço', icon: '⟳', description: 'Gira a espada grande e atinge todos os inimigos em volta.', cooldown: 8200, manaCost: 12, kind: 'areaDamage', radius: 145, multiplier: 1.65 },
  { id: 'warriorWarCry', name: 'Grito de Desafio', icon: '◖', description: 'Um brado de guerra cura o guerreiro e provoca monstros próximos.', cooldown: 16000, manaCost: 10, kind: 'healTaunt', healRatio: 0.2, tauntRadius: 290, tauntDuration: 10000 },
  { id: 'warriorIronWill', name: 'Postura de Ferro', icon: '⬡', description: 'Enrijece a armadura e aumenta as defesas por alguns instantes.', cooldown: 19000, manaCost: 14, kind: 'defenseBuff', defenseRatio: 0.1, duration: 10000 },
  { id: 'warriorChains', name: 'Correntes da Ruína', icon: '⌁', description: 'Acorrenta e puxa inimigos de uma grande área, provocando-os.', cooldown: 22000, manaCost: 20, kind: 'chainPull', radius: 360, pullDistance: 84, tauntDuration: 10000 }
];

export const RANGED_ATTACK_RANGE = { mage: 250, archer: 290 };
export const MELEE_ATTACK_RANGE = 46;
