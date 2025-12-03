import { ProposedFeature } from '@/types/storage';

/**
 * Proposed features for user voting in feedback modal
 */
export const PROPOSED_FEATURES: ProposedFeature[] = [
  {
    id: 'cloud-storage',
    name: 'Save to Cloud',
    description: 'Store your GIFs in cloud storage for easy access',
    category: 'storage',
  },
  {
    id: 'community-gallery',
    name: 'Community Gallery',
    description: "Browse your GIFs and discover others' creations",
    category: 'community',
  },
  {
    id: 'slack-integration',
    name: 'Slack Integration',
    description: 'Share GIFs directly to Slack workspaces',
    category: 'sharing',
  },
  {
    id: 'discord-integration',
    name: 'Discord Integration',
    description: 'Share GIFs directly to Discord channels',
    category: 'sharing',
  },
];

/**
 * External survey URL for detailed feedback
 * Replace with actual Google Forms/Typeform URL
 */
export const EXTERNAL_SURVEY_URL = 'https://forms.gle/evQ5EGdEhUxDhejU7';
