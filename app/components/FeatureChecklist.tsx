export default function FeatureChecklist() {
  const features = [
    'Choose Your FPS',
    'Custom Text Overlay',
    'Multiple Resolutions',
    'In Player Controls',
  ];

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-3 justify-start">
      {features.map((feature) => (
        <div key={feature} className="flex items-center gap-1.5 text-xs sm:text-sm lg:text-base text-white font-semibold">
          <svg width="20" height="20" className="text-[#E91E8C] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>{feature}</span>
        </div>
      ))}
    </div>
  );
}
