// Official MTA line colors.
const RED = "#EE352E";
const GREEN = "#00933C";
const BLUE = "#0039A6";
const ORANGE = "#FF6319";
const YELLOW = "#FCCC0A";
const LIGHT_GREEN = "#6CBE45";
const PURPLE = "#B933AD";
const BROWN = "#996633";
const GRAY = "#A7A9AC";
const DARK_GRAY = "#808183";

const COLORS: Record<string, string> = {
  "1": RED,
  "2": RED,
  "3": RED,
  "4": GREEN,
  "5": GREEN,
  "6": GREEN,
  "7": PURPLE,
  A: BLUE,
  C: BLUE,
  E: BLUE,
  B: ORANGE,
  D: ORANGE,
  F: ORANGE,
  M: ORANGE,
  G: LIGHT_GREEN,
  J: BROWN,
  Z: BROWN,
  L: GRAY,
  N: YELLOW,
  Q: YELLOW,
  R: YELLOW,
  W: YELLOW,
  S: DARK_GRAY,
};

export function lineColors(line: string): { background: string; color: string } {
  const background = COLORS[line.toUpperCase()] ?? DARK_GRAY;
  // Yellow lines use black text on the real signs.
  const color = background === YELLOW ? "#111111" : "#ffffff";
  return { background, color };
}
