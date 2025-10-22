import { DEMO_VIDEO_EMBED_URL } from '@/lib/constants';

export default function DemoVideo() {
  return (
    <div className="relative">
      <div className="relative rounded-3xl overflow-hidden bg-gray-800 border-2 border-gray-700 shadow-2xl p-2">
        <div className="relative w-full rounded-2xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={DEMO_VIDEO_EMBED_URL}
            title="YTgify Demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute top-0 left-0 w-full h-full"
            style={{ border: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
