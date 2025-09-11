// Manual Test Script for Dual Text Overlay Feature
// Run this in the browser console after loading the extension on a YouTube video

console.log('🧪 Starting Dual Text Overlay Manual Test...');

// Test 1: Check if both text inputs exist
async function testDualTextInputs() {
  console.log('\n📝 Test 1: Checking for dual text inputs...');
  
  // Click GIF button
  const gifButton = document.querySelector('.ytgif-button');
  if (!gifButton) {
    console.error('❌ GIF button not found');
    return false;
  }
  gifButton.click();
  
  // Wait for wizard
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Click Quick Capture
  const quickCapture = document.querySelector('button[class*="quick-capture"]') || 
                       Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quick Capture'));
  if (quickCapture) {
    quickCapture.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Check for text inputs
  const topTextInput = document.querySelector('input[placeholder*="top text"]');
  const bottomTextInput = document.querySelector('input[placeholder*="bottom text"]');
  
  if (topTextInput && bottomTextInput) {
    console.log('✅ Both text inputs found');
    console.log('  - Top text input:', topTextInput);
    console.log('  - Bottom text input:', bottomTextInput);
    return true;
  } else {
    console.error('❌ Missing text inputs');
    console.log('  - Top text input:', topTextInput);
    console.log('  - Bottom text input:', bottomTextInput);
    return false;
  }
}

// Test 2: Check if text preview works
async function testTextPreview() {
  console.log('\n📝 Test 2: Testing text preview...');
  
  const topTextInput = document.querySelector('input[placeholder*="top text"]');
  const bottomTextInput = document.querySelector('input[placeholder*="bottom text"]');
  
  if (!topTextInput || !bottomTextInput) {
    console.error('❌ Text inputs not found');
    return false;
  }
  
  // Enter text
  topTextInput.value = 'TEST TOP TEXT';
  topTextInput.dispatchEvent(new Event('input', { bubbles: true }));
  
  bottomTextInput.value = 'TEST BOTTOM TEXT';
  bottomTextInput.dispatchEvent(new Event('input', { bubbles: true }));
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check preview
  const previews = document.querySelectorAll('.ytgif-text-preview-overlay');
  if (previews.length >= 2) {
    console.log('✅ Both text previews rendered');
    console.log('  - Preview 1:', previews[0].textContent);
    console.log('  - Preview 2:', previews[1].textContent);
    return true;
  } else if (previews.length === 1) {
    console.warn('⚠️ Only one preview found');
    console.log('  - Preview:', previews[0].textContent);
    return false;
  } else {
    console.error('❌ No previews found');
    return false;
  }
}

// Test 3: Check style controls
async function testStyleControls() {
  console.log('\n📝 Test 3: Testing style controls...');
  
  // Click style buttons
  const styleButtons = Array.from(document.querySelectorAll('button')).filter(b => 
    b.textContent.includes('Text Style')
  );
  
  console.log(`Found ${styleButtons.length} style buttons`);
  
  if (styleButtons.length >= 2) {
    console.log('✅ Both style buttons found');
    
    // Click first button
    styleButtons[0].click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const topControls = document.querySelector('.ytgif-text-section');
    const hasTopSlider = topControls?.querySelector('input[type="range"]');
    const hasTopColor = topControls?.querySelector('input[type="color"]');
    
    if (hasTopSlider && hasTopColor) {
      console.log('✅ Top text style controls work');
    } else {
      console.error('❌ Top text style controls missing');
    }
    
    // Click second button
    styleButtons[1].click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const sections = document.querySelectorAll('.ytgif-text-section');
    if (sections.length >= 2) {
      const bottomControls = sections[1];
      const hasBottomSlider = bottomControls?.querySelector('input[type="range"]');
      const hasBottomColor = bottomControls?.querySelector('input[type="color"]');
      
      if (hasBottomSlider && hasBottomColor) {
        console.log('✅ Bottom text style controls work');
        return true;
      } else {
        console.error('❌ Bottom text style controls missing');
        return false;
      }
    }
  } else {
    console.error('❌ Style buttons not found');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running all dual text overlay tests...\n');
  
  const results = {
    dualInputs: await testDualTextInputs(),
    preview: await testTextPreview(),
    styleControls: await testStyleControls()
  };
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`Dual Text Inputs: ${results.dualInputs ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Text Preview: ${results.preview ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Style Controls: ${results.styleControls ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️ Some tests failed'}`);
  
  return results;
}

// Instructions
console.log(`
📋 Manual Test Instructions:
============================
1. Make sure the extension is loaded
2. Navigate to a YouTube video
3. Wait for the page to fully load
4. Run: runAllTests()

Or test individually:
- testDualTextInputs()
- testTextPreview()
- testStyleControls()
`);

// Make functions available globally
window.testDualText = {
  runAllTests,
  testDualTextInputs,
  testTextPreview,
  testStyleControls
};