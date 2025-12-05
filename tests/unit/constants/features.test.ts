import { EXTERNAL_SURVEY_URL } from '../../../src/constants/features';

describe('features constants', () => {
  describe('EXTERNAL_SURVEY_URL', () => {
    it('should be the correct Google Form URL', () => {
      expect(EXTERNAL_SURVEY_URL).toBe('https://forms.gle/evQ5EGdEhUxDhejU7');
    });

    it('should be a valid Google Forms short URL', () => {
      expect(EXTERNAL_SURVEY_URL).toMatch(/^https:\/\/forms\.gle\/[a-zA-Z0-9]+$/);
    });
  });
});
