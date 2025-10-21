export default function FeatureChecklist() {
  const features = [
    'Choose Your FPS',
    'Custom Text Overlay',
    'Multiple Resolutions',
    'In Player Controls',
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
      {features.map((feature) => (
        <div key={feature} className="flex items-center gap-3 text-base lg:text-lg text-gray-200 font-bold">
          <svg width="24" height="24" className="text-[#E91E8C] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>{feature}</span>
        </div>
      ))}
    </div>
  );
}
