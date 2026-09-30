/**
 * Social stories (plan Phase 5, like Pictello): short first-person picture
 * books that tell a child what to expect from a new or hard situation, so
 * it is familiar before it happens. Written the way social stories usually
 * are: mostly describing, calm, positive, and never promising exactly what
 * will happen ("might", "usually").
 *
 * Stories — and any photos a parent adds — live only on this device
 * (shared/deviceLists.ts): they are about the child's own life.
 */
import type { Ionicons } from "@expo/vector-icons";

export type StoryIcon = keyof typeof Ionicons.glyphMap;

export interface StoryPage {
  id: string;
  text: string;
  /** Emoji picture shown when there is no photo — it shows the real thing
   * (a dentist's chair, not a bed), which matters to literal readers. */
  picture: string;
  photo?: string | null; // small JPEG data URI from the parent
}

export interface Story {
  id: string;
  title: string;
  icon: StoryIcon; // for the parent's list
  picture: string; // the book's cover for the child
  pages: StoryPage[];
}

export const BLANK_PICTURE = "📖";

export const MAX_STORIES = 20;
export const MAX_PAGES = 12;

export const newStoryId = () => `st${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type Template = { title: string; icon: StoryIcon; picture: string; pages: [string, string][] };

export const STORY_TEMPLATES: Template[] = [
  {
    title: "Getting a haircut",
    icon: "cut",
    picture: "💇",
    pages: [
      ["Sometimes my hair gets long. Then it is time for a haircut.", "💇"],
      ["We go to the hairdresser. I sit in a big chair.", "💈"],
      ["The hairdresser puts a cape on me, so hair does not get on my clothes.", "👕"],
      ["The clippers might make a buzzing sound. That's okay. I can hold my toy or cover my ears.", "🔊"],
      ["Sitting still helps the hairdresser. I can count to ten, or take big breaths.", "🔢"],
      ["When it is finished, I can look in the mirror. My hair is short and tidy!", "🪞"],
    ],
  },
  {
    title: "Going to the dentist",
    icon: "medkit",
    picture: "🦷",
    pages: [
      ["Sometimes I go to the dentist, to help keep my teeth healthy.", "🦷"],
      ["I sit in a special chair. It can lean back.", "💺"],
      ["The dentist has a bright light to see my teeth. I can close my eyes if it is too bright.", "💡"],
      ["The dentist asks me to open my mouth wide. They count my teeth.", "😁"],
      ["It might feel a bit strange. I can raise my hand if I need a break.", "✋"],
      ["When we are done, my teeth are clean and healthy. Well done me!", "⭐"],
    ],
  },
  {
    title: "My new school",
    icon: "school",
    picture: "🏫",
    pages: [
      ["Soon I will go to a new school.", "🏫"],
      ["There will be a new teacher. My teacher will help me.", "🧑‍🏫"],
      ["There will be other children in my class. Some may want to play with me.", "👫"],
      ["Everything might feel new at first. It is okay to feel worried.", "💛"],
      ["If I need help, I can ask my teacher.", "🙋"],
      ["Each day, my new school will feel a little more familiar.", "☀️"],
    ],
  },
  {
    title: "Going to a birthday party",
    icon: "gift",
    picture: "🎂",
    pages: [
      ["I am going to a birthday party!", "🎁"],
      ["There might be lots of people and noise. I can take a break in a quiet place if I need to.", "🔇"],
      ["People might sing Happy Birthday. The singing can be loud, and it ends soon.", "🎵"],
      ["There may be games. I can play, or I can watch.", "🎲"],
      ["There will probably be cake. I can eat some if I want to.", "🎂"],
      ["When the party ends, we say goodbye and go home.", "🏠"],
    ],
  },
];

export function storyFromTemplate(t: Template): Story {
  return {
    id: newStoryId(),
    title: t.title,
    icon: t.icon,
    picture: t.picture,
    pages: t.pages.map(([text, picture], i) => ({ id: `${newStoryId()}${i}`, text, picture })),
  };
}
