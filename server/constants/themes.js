/**
 * Story theme categories and canonical Bible stories for Family Story Night.
 */

export const CANONICAL_BIBLE_STORIES = [
  { title: "Noah's Ark & the Rainbow Promise", reference: "Genesis 6–9", virtue: "Patience & God's faithfulness" },
  { title: "David & Goliath (Courage in God)", reference: "1 Samuel 17", virtue: "Courage & trust in God" },
  { title: "Daniel in the Lions' Den", reference: "Daniel 6", virtue: "Steadfast faith & prayer" },
  { title: "Jonah and the Big Fish", reference: "Jonah 1–4", virtue: "Second chances & obedience" },
  { title: "Jesus Calms the Wind & the Waves", reference: "Mark 4:35–41", virtue: "Peace & trusting Jesus in storms" },
  { title: "The Good Samaritan", reference: "Luke 10:25–37", virtue: "Loving and helping our neighbors" },
  { title: "The Shepherd and the Lost Sheep", reference: "Luke 15:1–7", virtue: "How deeply God loves every one of us" },
  { title: "Moses and the Parting of the Red Sea", reference: "Exodus 14", virtue: "God makes a way through the sea" },
  { title: "Ruth and Naomi's Loyal Love", reference: "Ruth 1–2", virtue: "Family loyalty & kindness" },
  { title: "The Nativity & the Star of Bethlehem", reference: "Luke 2", virtue: "Hope, peace & joy" },
  { title: "Joseph's Colorful Coat & Forgiveness", reference: "Genesis 37, 45", virtue: "Forgiveness & God's good plan" },
  { title: "Jesus Feeds the Five Thousand", reference: "John 6:1–14", virtue: "Gratitude & sharing with others" },
];

export const THEME_CATEGORIES = [
  {
    id: "adventures",
    label: "Bedtime Adventures",
    iconName: "Sparkles",
    themes: [
      "a cozy adventure",
      "a magical treasure hunt",
      "a trip to outer space",
      "a friendly dragon's forest",
    ],
  },
  {
    id: "bible",
    label: "Bible Stories",
    iconName: "BookOpen",
    themes: CANONICAL_BIBLE_STORIES.map((s) => s.title),
  },
  {
    id: "fables",
    label: "Fables & Folk Wisdom",
    iconName: "Feather",
    themes: [
      "The Tortoise and the Hare (patience & perseverance)",
      "The Lion and the Little Mouse (kindness rewarded)",
      "The Wind and the Warm Sun (gentleness wins)",
      "The Ant and the Grasshopper (sharing & preparation)",
      "Anansi and the Pot of Wisdom (humility & learning)",
    ],
  },
  {
    id: "nature",
    label: "Gentle Nature & Animals",
    iconName: "Trees",
    themes: [
      "Little Bear prepares for the winter sleep",
      "The owl's starlit forest flight",
      "The river otter's quiet creek journey",
      "The coral reef under peaceful moonlight",
      "The sleepy hedgehog finds a cozy moss bed",
    ],
  },
  {
    id: "science",
    label: "Little Explorers",
    iconName: "Rocket",
    themes: [
      "A visit to the sleepy moon",
      "Journey of the little raindrop",
      "Deep ocean glow in a quiet submarine",
      "The dancing green northern lights",
      "The friendly satellite watching bedtime on Earth",
    ],
  },
  {
    id: "calm",
    label: "Sleepy Dreams & Lullabies",
    iconName: "Moon",
    themes: [
      "The cloud that floated to the starlight",
      "The quiet village of whispering lanterns",
      "A cozy treehouse in the gentle evening rain",
      "The pajama express to dreamland",
      "The sleepy lighthouse warming the night sea",
    ],
  },
];

export const DEFAULT_CATEGORY_ID = "adventures";

export const THEMES = THEME_CATEGORIES[0].themes;
