/* Code-native illustrations share the site's palette, including offline mode. */
const wordDrawings = {
  passport:
    '<rect x="37" y="20" width="66" height="84" rx="7"/><circle cx="70" cy="53" r="17"/><ellipse cx="70" cy="53" rx="7" ry="17"/><path d="M53 53h34M56 43h28M56 63h28M55 83h30M60 91h20"/>',
  ticket:
    '<path d="M25 36h90v18a10 10 0 0 0 0 20v18H25V74a10 10 0 0 0 0-20Z"/><path stroke-dasharray="4 5" d="M92 38v52"/><path d="M40 53h35M40 65h25M40 77h30"/>',
  suitcase:
    '<rect x="31" y="35" width="78" height="62" rx="9"/><path d="M54 35V23h32v12M47 36v60M93 36v60M43 102v4M97 102v4"/>',
  bag: '<path d="M35 42h70l8 59H27Z"/><path d="M52 43V31a18 18 0 0 1 36 0v12"/>',
  gate: '<path d="M25 104V24h90v80M70 25v79M35 89h70"/><path d="M55 55h30m-9-9 9 9-9 9"/>',
  seat: '<path d="M43 20h34a8 8 0 0 1 8 8v41H44Z"/><path d="M44 69h54v16H44a9 9 0 0 1-9-9V55M50 85v20M90 85v20M85 58h19"/>',
  plane:
    '<path d="m18 70 40-17 5-30q7-12 14 0l5 30 40 17v9l-41-8-1 20 15 10v7l-25-7-25 7v-7l15-10-1-20-41 8Z"/>',
  tray: '<path d="m22 45 17 48h62l17-48ZM22 45l17-14h62l17 14M39 78h62"/>',
  bottle:
    '<path d="M59 18h22v14l10 14v51q0 9-9 9H58q-9 0-9-9V46l10-14Z"/><path d="M58 23h24M49 57h42M49 86h42"/>',
  laptop:
    '<rect x="30" y="24" width="80" height="56" rx="5"/><path d="m30 80-13 17q-3 7 8 7h90q11 0 8-7l-13-17M62 94h16"/>',
  belt: '<path d="M20 48h100v32H20Z"/><rect x="49" y="42" width="38" height="44" rx="4"/><path d="M67 64h33M109 64h1"/>',
  pocket:
    '<path d="M36 24h68v60L70 105 36 84ZM36 39h68"/><path stroke-dasharray="3 4" d="M43 45v35l27 17 27-17V45"/>',
  shield:
    '<path d="m70 16 40 17v30q0 27-40 46-40-19-40-46V33Z"/><path d="m50 61 14 14 27-30"/>',
  calendar:
    '<rect x="26" y="30" width="88" height="75" rx="8"/><path d="M26 50h88M47 21v19M94 21v19M42 68h12M64 68h12M86 68h12M42 86h12M64 86h12"/>',
  briefcase:
    '<rect x="24" y="38" width="92" height="62" rx="6"/><path d="M51 38V24h38v14M24 62q46 23 92 0"/><rect x="62" y="62" width="16" height="16" rx="2"/>',
  pin: '<path d="M70 110s-34-37-34-61a34 34 0 0 1 68 0c0 24-34 61-34 61Z"/><circle cx="70" cy="49" r="12"/>',
  document:
    '<path d="M36 18h47l23 24v64H36ZM83 18v24h23M50 61h42M50 75h42M50 89h28"/>',
  clock: '<circle cx="70" cy="64" r="43"/><path d="M70 32v32l23 14"/>',
  blanket:
    '<rect x="32" y="24" width="76" height="80" rx="7"/><path d="M32 42h76M48 25v79M70 25v79M92 25v79M32 63h76M32 84h76"/>',
  pillow: '<path d="M26 35q44 10 88 0-8 30 0 60-44-10-88 0 8-30 0-60Z"/>',
  cup: '<path d="M32 43h66v35q0 24-33 24T32 78ZM98 51h9a15 15 0 0 1 0 30h-9M40 113h56M47 30V18M64 30V13M81 30V18"/>',
  key: '<circle cx="48" cy="47" r="23"/><path d="m65 64 42 42 10-10-9-9 7-7-10-10-7 7-12-12"/><circle cx="42" cy="41" r="5"/>',
  bed: '<path d="M24 35v70M116 58v47M24 85h92M24 58h83q9 0 9 9v18M30 42h30v16H30Z"/>',
  towel: '<path d="M27 25h72v80H27ZM99 25h14v65H99M27 85h72M27 94h72"/>',
  shower:
    '<path d="M41 106V40q0-24 23-24t23 24M69 43h36l-5-11H75Z"/><path stroke-dasharray="4 8" d="M73 54v43M87 54v43M101 54v43"/>',
  thermometer:
    '<path d="M61 76V25a9 9 0 0 1 18 0v51a21 21 0 1 1-18 0Z"/><path d="M70 38v48M88 32h14M88 47h10M88 62h14"/>',
  taxi: '<path d="m29 57 13-27h56l13 27M20 57h100v36H20ZM54 30V18h32v12M20 93v13h16V93M104 93v13h16V93"/><circle cx="39" cy="75" r="6"/><circle cx="101" cy="75" r="6"/>',
  receipt:
    '<path d="M38 20h64v88l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6ZM49 38h42M49 53h42M49 68h26M49 85h42"/>',
  cash: '<rect x="20" y="34" width="100" height="58" rx="5"/><circle cx="70" cy="63" r="19"/><path d="M31 47h10M99 79h10M67 52h9M70 52v22M65 74h11"/>',
  card: '<rect x="22" y="32" width="96" height="64" rx="8"/><path d="M22 51h96M35 79h20M64 79h14"/>',
  food: '<circle cx="70" cy="65" r="31"/><circle cx="70" cy="65" r="23"/><path d="M21 27v77M12 27v27h18V27M122 26v78M122 26q-16 20 0 39"/>',
  nut: '<path d="M70 18q-37 22-34 56t34 35q32-1 34-35T70 18Z"/><path d="M70 28v70M55 42l15 13 15-13M50 65l20 14 20-14"/>',
  leaf: '<path d="M110 20Q19 24 28 81q4 27 34 20 47-13 48-81Z"/><path d="m26 110 65-65M49 85V57M66 68h26"/>',
  arrow: '<path d="M20 50h62V29l38 35-38 35V78H20Z"/>',
  train:
    '<rect x="36" y="18" width="68" height="82" rx="15"/><path d="M36 62h68M51 100l-12 14M89 100l12 14M48 32h44v20H48Z"/><circle cx="51" cy="81" r="5"/><circle cx="89" cy="81" r="5"/>',
  shirt:
    '<path d="m48 22-30 20 15 25 13-8v48h48V59l13 8 15-25-30-20q-22 18-44 0Z"/>',
  size: '<path d="M22 44h96v40H22ZM36 44v20M50 44v12M64 44v20M78 44v12M92 44v20M106 44v12"/>',
  exchange:
    '<path d="M24 48q18-39 72-17l16 9M97 17l15 23-28 4M116 80q-18 39-72 17l-16-9M43 111 28 88l28-4"/>',
  medical:
    '<rect x="25" y="30" width="90" height="72" rx="10"/><path d="M53 30V18h34v12M61 47h18v12h12v18H79v12H61V77H49V59h12Z"/>',
  head: '<path d="M45 110V88q-17-12-17-39a37 37 0 0 1 74 0l12 20h-12v18q0 9-10 9H78v14M61 34l-8 17 15 5-9 20"/>',
  help: '<circle cx="70" cy="64" r="43"/><path d="M55 49a15 15 0 1 1 24 13q-9 6-9 15M70 92v1"/>',
  quiet: '<path d="M26 51h20l25-22v70L46 77H26ZM90 48l24 32M114 48 90 80"/>',
};
const wordGroups = {
  passport: ["passport"],
  ticket: [
    "boarding pass",
    "return ticket",
    "ticket",
    "single",
    "return",
    "connection",
  ],
  suitcase: ["suitcase", "luggage", "overhead locker"],
  bag: ["bag", "carry-on"],
  gate: ["gate", "terminal", "fitting room"],
  seat: ["window seat", "aisle seat", "seat", "row"],
  plane: ["flight", "departure", "holiday"],
  tray: ["tray"],
  bottle: ["liquid", "water", "juice", "milk"],
  laptop: ["laptop"],
  belt: ["belt", "seat belt"],
  pocket: ["pocket"],
  shield: ["security", "police"],
  calendar: ["week", "stay"],
  briefcase: ["business"],
  pin: ["address", "destination", "embassy"],
  document: ["document", "report", "reservation", "purpose"],
  clock: ["delay"],
  blanket: ["blanket"],
  pillow: ["pillow"],
  cup: ["coffee", "tea", "sugar"],
  key: ["key", "reception"],
  bed: ["room"],
  towel: ["towel"],
  shower: ["shower"],
  thermometer: ["heating"],
  quiet: ["quiet"],
  taxi: ["taxi", "traffic", "fare", "meter"],
  receipt: ["receipt", "bill", "charge", "price"],
  cash: ["cash", "tip", "discount"],
  card: ["card"],
  food: ["ingredient"],
  nut: ["nuts", "allergy"],
  leaf: ["vegetarian"],
  arrow: ["left", "right", "straight"],
  train: ["station", "platform"],
  shirt: ["shirt"],
  size: ["size", "medium"],
  exchange: ["refund", "exchange", "broken"],
  medical: ["ambulance", "pharmacy", "medicine"],
  head: ["headache"],
  help: ["help", "emergency", "lost"],
};
function wordIllustration(step) {
  if (step.image) return sceneMarkup("", step.image);
  const word = String(step.prompt).toLowerCase(),
    key = Object.keys(wordGroups).find((k) => wordGroups[k].includes(word));
  if (!key) return sceneMarkup(step.scene);
  return `<div class="learning-word-art"><svg viewBox="0 0 140 130" role="img" aria-label="${esc(step.translation || step.prompt)}"><circle cx="70" cy="65" r="58" fill="currentColor" opacity=".07"/><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${wordDrawings[key]}</g></svg><span>${esc(step.translation)}</span></div>`;
}
wordGroups.gate.push("check out");
