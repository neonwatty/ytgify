# YTgify Landing Page

A beautiful, high-converting landing page for the YTgify Chrome extension, built with Next.js, Tailwind CSS, and Framer Motion.

## Features

- 🎨 Custom gradient theme matching YTgify branding
- ✨ Smooth animations with Framer Motion
- 📱 Fully responsive design
- 🚀 Static export for GitHub Pages
- ⚡ Optimized performance with Next.js 15
- 🎯 Interactive demo section
- 🖼️ GIF gallery showcase

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
```

This creates a static export in the `out` directory.

### Testing Production Build Locally

```bash
npm run build
npx serve out
```

## Deployment

The landing page is configured for automatic deployment to GitHub Pages via GitHub Actions.

### Manual Deployment

1. Build the site:
```bash
npm run build
```

2. The static files will be in the `out` directory

### Automatic Deployment

Push to the `landing-page` branch triggers automatic deployment via GitHub Actions.

## Project Structure

```
landing-page/
├── app/
│   ├── components/     # React components
│   │   ├── Hero.tsx
│   │   ├── Demo.tsx
│   │   ├── Features.tsx
│   │   ├── Gallery.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── CTA.tsx
│   │   └── Footer.tsx
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── lib/
│   └── constants.ts    # Configuration
├── public/             # Static assets
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions

```

## Color Theme

The landing page uses YTgify's signature gradient theme:
- **Red**: #FF0050
- **Pink**: #FF0080
- **Purple**: #8B5CF6
- **Background**: Black (#000000)

## Technologies

- **Next.js 15** - React framework with static export
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Icons** - Icon components
- **TypeScript** - Type safety

## Configuration

### GitHub Pages Base Path

The site is configured to work with GitHub Pages at `/ytgify` path. This is handled in `next.config.ts`:

```typescript
basePath: process.env.NODE_ENV === 'production' ? '/ytgify' : ''
```

### Chrome Extension URL

Update the extension URL in `lib/constants.ts`:

```typescript
export const CHROME_EXTENSION_URL = 'https://chrome.google.com/webstore/detail/[YOUR_EXTENSION_ID]';
```

## License

Same as parent YTgify project.