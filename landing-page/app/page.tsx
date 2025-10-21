import GitHubStyleHero from './components/GitHubStyleHero';
import GitHubStyleCTA from './components/GitHubStyleCTA';
import GitHubStyleFooter from './components/GitHubStyleFooter';

export default function Home() {
  return (
    <main className="min-h-screen">
      <GitHubStyleHero />
      <GitHubStyleCTA />
      <GitHubStyleFooter />
    </main>
  );
}