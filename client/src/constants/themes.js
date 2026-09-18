/**
 * Story theme categories and presets for Family Story Night.
 */

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
    themes: [
      "Noah's Ark and the rainbow promise",
      "David and the giant of courage",
      "Daniel in the lions' den",
      "Jonah and the big fish",
      "The Good Samaritan helping a friend",
      "The starry night in Bethlehem",
    ],
  },
];

export const DEFAULT_CATEGORY_ID = "adventures";

// Backward-compatible default themes array
export const THEMES = THEME_CATEGORIES[0].themes;
