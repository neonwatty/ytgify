/**
 * YouTube Video Type Test Matrix
 * Test URLs for various YouTube content types to ensure extension compatibility
 */

export const testMatrix = [
  {
    type: 'Regular Video',
    url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    expectedBehavior: 'Works normally',
    status: 'pending'
  },
  {
    type: 'YouTube Shorts',
    url: 'https://youtube.com/shorts/V_MXGdSBbAI',
    expectedBehavior: 'Works normally',
    status: 'pending'
  },
  {
    type: 'Live Stream (VOD)',
    url: 'https://youtube.com/watch?v=21X5lGlDOfg', // NASA live stream archive
    expectedBehavior: 'Works normally',
    status: 'pending'
  },
  {
    type: '360° Video',
    url: 'https://youtube.com/watch?v=aqz-KE-bpKQ',
    expectedBehavior: 'Works normally',
    status: 'pending'
  },
  {
    type: '4K Video',
    url: 'https://youtube.com/watch?v=LXb3EKWsInQ', // Costa Rica 4K
    expectedBehavior: 'Works normally',
    status: 'pending'
  },
  {
    type: 'Long Video (>1hr)',
    url: 'https://youtube.com/watch?v=EngW7tLk6R8', // Long compilation
    expectedBehavior: 'Works normally',
    status: 'pending'
  },
  {
    type: 'Music Video',
    url: 'https://youtube.com/watch?v=CevxZvSJLk8', // Katy Perry - Roar
    expectedBehavior: 'Works normally',
    status: 'pending'
  },
  {
    type: 'Video with Ads',
    url: 'https://youtube.com/watch?v=9bZkp7q19f0', // Gangnam Style (monetized)
    expectedBehavior: 'Works after ad',
    status: 'pending'
  },
  {
    type: 'Embedded Video (iframe)',
    testHTML: '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
    expectedBehavior: 'Check behavior in embedded context',
    status: 'pending'
  },
  {
    type: 'Age-Restricted',
    url: 'https://youtube.com/watch?v=example', // Replace with actual age-restricted
    expectedBehavior: 'Graceful failure with message',
    status: 'pending'
  },
  {
    type: 'Private Video',
    url: 'https://youtube.com/watch?v=private_example',
    expectedBehavior: 'GIF button should not appear',
    status: 'pending'
  },
  {
    type: 'YouTube Music',
    url: 'https://music.youtube.com',
    expectedBehavior: 'Extension should not activate',
    status: 'pending'
  }
];

// Test runner function
export async function runTestMatrix() {
  const results = [];
  
  for (const test of testMatrix) {
    console.log(`Testing: ${test.type}`);
    console.log(`URL: ${test.url || 'N/A'}`);
    console.log(`Expected: ${test.expectedBehavior}`);
    console.log('---');
    
    // Manual testing required - log for now
    results.push({
      ...test,
      testedAt: new Date().toISOString(),
      status: 'requires_manual_testing'
    });
  }
  
  return results;
}

// Export for use in automated tests
export default testMatrix;