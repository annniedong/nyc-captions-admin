export type Voice = {
  id: string;
  label: string;
  line: string;
  blurb: string;
  example: string;
  instruction: string;
};

export const VOICES: Voice[] = [
  {
    id: "jaded-nyer",
    label: "Jaded New Yorker",
    line: "6",
    blurb: "Seen it all. Impressed by nothing.",
    example: "\"A man in a full chicken suit on the 6 train. Tuesday, then.\"",
    instruction:
      "A deadpan lifelong New Yorker who has seen everything twice. Dry, unimpressed, a little exhausted. Mentions of the MTA, rent, and bodegas are welcome when they fit.",
  },
  {
    id: "midwest-tourist",
    label: "Midwest in the Big City",
    line: "N",
    blurb: "Wide-eyed, polite, comparing it all to home.",
    example: "\"Ope, sorry, I think I just bumped into the whole city.\"",
    instruction:
      "A very polite, wide-eyed person from the Midwest who is new to New York. Overly earnest, apologizes to inanimate objects, and keeps comparing things to back home.",
  },
  {
    id: "columbia-gc",
    label: "Columbia group chat",
    line: "1",
    blurb: "Chronically online. Library at 2am.",
    example: "\"me walking into butler at 1:58am like it owes me an A\"",
    instruction:
      "A chronically online college student posting in the group chat. Lowercase, meme-literate, a bit unhinged, with references to midterms, Butler Library at 2am, and dining hall disappointment.",
  },
  {
    id: "pigeon",
    label: "The pigeon's POV",
    line: "A",
    blurb: "Narrated by a very opinionated city pigeon.",
    example: "\"My city. My crust. Back up.\"",
    instruction:
      "A smug New York City pigeon narrating the scene. Territorial, food-motivated, and convinced the whole city belongs to it.",
  },
];

export function getVoice(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}

export function buildPrompt(voice: Voice): string {
  return [
    "You write captions for photos shared on a humor site for college students in New York City.",
    `Voice: ${voice.instruction}`,
    "Rules:",
    "- Look carefully at the photo and make every caption specific to what is actually in it.",
    "- Write exactly 3 different captions, each under 140 characters.",
    "- Punchy and funny. No hashtags and no emojis. Do not be cruel to any individual in the photo.",
    '- If the photo contains nudity, graphic violence, or a clearly identifiable private person in a sensitive situation, set "safe" to false and return an empty captions list.',
    'Return JSON with "safe" (boolean) and "captions" (array of strings).',
  ].join("\n");
}

const CHALLENGES = [
  "Something unreasonably large someone carried on the subway",
  "The most NYC thing you saw on your way to class",
  "A bodega cat with a lot of authority",
  "A line you waited in that was not worth it",
  "Scaffolding that has been up longer than you have lived here",
  "A pigeon doing something it should not be doing",
  "The best-dressed (or worst-dressed) dog you passed today",
  "A sign that made you do a double take",
  "Your view from the 1 train, or the least-bad seat in the library",
  "A street food cart at its most chaotic",
  "Something free that you absolutely took",
  "A tourist spot, photographed from the angle locals see it",
  "The weirdest thing on a stoop or a curb",
  "Your dorm room, at its most honest",
];

export function todaysChallenge(now: Date = new Date()): string {
  const nyDate = now.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const dayNumber = Math.floor(Date.parse(nyDate) / 86_400_000);
  return CHALLENGES[dayNumber % CHALLENGES.length];
}
