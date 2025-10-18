import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MilestoneScreen from '../../../../src/content/overlay-wizard/screens/MilestoneScreen';
import * as links from '../../../../src/constants/links';
import * as socialTemplates from '../../../../src/utils/social-templates';

// Mock dependencies
jest.mock('../../../../src/constants/links', () => ({
  openExternalLink: jest.fn(),
  getReviewLink: jest.fn(() => 'https://chrome.google.com/webstore/review'),
  getGitHubStarLink: jest.fn(() => 'https://github.com/neonwatty/ytgify'),
}));

jest.mock('../../../../src/utils/social-templates', () => ({
  getTwitterTemplates: jest.fn(() => [
    { label: 'Short', text: 'Short template' },
    { label: 'Medium', text: 'Medium template for milestones' },
    { label: 'Long', text: 'Long template' },
  ]),
  generateTwitterShareUrl: jest.fn((text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`),
}));

// Milestones have been removed from the CTA strategy
describe.skip('MilestoneScreen', () => {
  const mockOnContinue = jest.fn();
  const mockOnRate = jest.fn();
  const mockOnShare = jest.fn();
  const mockOnGitHub = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render milestone screen', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      expect(screen.getByText('Milestone!')).toBeInTheDocument();
      expect(screen.getByText("You've created 10 GIFs!")).toBeInTheDocument();
    });

    it('should render with milestone count 10', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      expect(screen.getByText('Milestone!')).toBeInTheDocument();
      expect(screen.getByText("You've created 10 GIFs!")).toBeInTheDocument();
    });

    it('should render with milestone count 25', () => {
      render(<MilestoneScreen milestoneCount={25} onContinue={mockOnContinue} />);

      expect(screen.getByText('Amazing Work!')).toBeInTheDocument();
      expect(screen.getByText("You've created 25 GIFs!")).toBeInTheDocument();
    });

    it('should render with milestone count 50', () => {
      render(<MilestoneScreen milestoneCount={50} onContinue={mockOnContinue} />);

      expect(screen.getByText('Legendary Creator!')).toBeInTheDocument();
      expect(screen.getByText("You've created 50 GIFs!")).toBeInTheDocument();
    });

    it('should render all action buttons', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      expect(screen.getByText('Rate YTGify')).toBeInTheDocument();
      expect(screen.getByText('Share on X')).toBeInTheDocument();
      expect(screen.getByText('Star on GitHub')).toBeInTheDocument();
    });

    it('should render continue button', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('should render milestone icon', () => {
      const { container } = render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const icon = container.querySelector('.ytgif-milestone-icon svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render support message', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      expect(screen.getByText('Help us grow by supporting YTGify:')).toBeInTheDocument();
    });
  });

  describe('Milestone Titles', () => {
    it('should show "Milestone!" for 10 GIFs', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      expect(screen.getByText('Milestone!')).toBeInTheDocument();
    });

    it('should show "Amazing Work!" for 25 GIFs', () => {
      render(<MilestoneScreen milestoneCount={25} onContinue={mockOnContinue} />);

      expect(screen.getByText('Amazing Work!')).toBeInTheDocument();
    });

    it('should show "Legendary Creator!" for 50 GIFs', () => {
      render(<MilestoneScreen milestoneCount={50} onContinue={mockOnContinue} />);

      expect(screen.getByText('Legendary Creator!')).toBeInTheDocument();
    });
  });

  describe('Rate Button', () => {
    it('should open review link when Rate button is clicked', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const rateButton = screen.getByText('Rate YTGify').closest('button');
      fireEvent.click(rateButton!);

      expect(links.openExternalLink).toHaveBeenCalledWith('https://chrome.google.com/webstore/review');
    });

    it('should call onRate callback when provided', () => {
      render(
        <MilestoneScreen
          milestoneCount={10}
          onContinue={mockOnContinue}
          onRate={mockOnRate}
        />
      );

      const rateButton = screen.getByText('Rate YTGify').closest('button');
      fireEvent.click(rateButton!);

      expect(mockOnRate).toHaveBeenCalledTimes(1);
    });

    it('should not throw when onRate is not provided', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const rateButton = screen.getByText('Rate YTGify').closest('button');

      expect(() => {
        fireEvent.click(rateButton!);
      }).not.toThrow();
    });

    it('should open link before calling callback', () => {
      const callOrder: string[] = [];

      (links.openExternalLink as jest.Mock).mockImplementation(() => {
        callOrder.push('openLink');
      });

      const onRate = jest.fn(() => {
        callOrder.push('callback');
      });

      render(
        <MilestoneScreen
          milestoneCount={10}
          onContinue={mockOnContinue}
          onRate={onRate}
        />
      );

      const rateButton = screen.getByText('Rate YTGify').closest('button');
      fireEvent.click(rateButton!);

      expect(callOrder).toEqual(['openLink', 'callback']);
    });
  });

  describe('Share Button', () => {
    it('should open Twitter share URL when Share button is clicked', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const shareButton = screen.getByText('Share on X').closest('button');
      fireEvent.click(shareButton!);

      expect(socialTemplates.getTwitterTemplates).toHaveBeenCalled();
      expect(socialTemplates.generateTwitterShareUrl).toHaveBeenCalledWith('Medium template for milestones');
      expect(links.openExternalLink).toHaveBeenCalledWith(
        'https://twitter.com/intent/tweet?text=Medium%20template%20for%20milestones'
      );
    });

    it('should use medium template (index 1)', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const shareButton = screen.getByText('Share on X').closest('button');
      fireEvent.click(shareButton!);

      expect(socialTemplates.generateTwitterShareUrl).toHaveBeenCalledWith('Medium template for milestones');
    });

    it('should call onShare callback when provided', () => {
      render(
        <MilestoneScreen
          milestoneCount={10}
          onContinue={mockOnContinue}
          onShare={mockOnShare}
        />
      );

      const shareButton = screen.getByText('Share on X').closest('button');
      fireEvent.click(shareButton!);

      expect(mockOnShare).toHaveBeenCalledTimes(1);
    });

    it('should not throw when onShare is not provided', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const shareButton = screen.getByText('Share on X').closest('button');

      expect(() => {
        fireEvent.click(shareButton!);
      }).not.toThrow();
    });
  });

  describe('GitHub Button', () => {
    it('should open GitHub repo link when GitHub button is clicked', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const githubButton = screen.getByText('Star on GitHub').closest('button');
      fireEvent.click(githubButton!);

      expect(links.openExternalLink).toHaveBeenCalledWith('https://github.com/neonwatty/ytgify');
    });

    it('should call onGitHub callback when provided', () => {
      render(
        <MilestoneScreen
          milestoneCount={10}
          onContinue={mockOnContinue}
          onGitHub={mockOnGitHub}
        />
      );

      const githubButton = screen.getByText('Star on GitHub').closest('button');
      fireEvent.click(githubButton!);

      expect(mockOnGitHub).toHaveBeenCalledTimes(1);
    });

    it('should not throw when onGitHub is not provided', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const githubButton = screen.getByText('Star on GitHub').closest('button');

      expect(() => {
        fireEvent.click(githubButton!);
      }).not.toThrow();
    });
  });

  describe('Continue Button', () => {
    it('should call onContinue when Continue button is clicked', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const continueButton = screen.getByText('Continue').closest('button');
      fireEvent.click(continueButton!);

      expect(mockOnContinue).toHaveBeenCalledTimes(1);
    });

    it('should be always rendered', () => {
      render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      const continueButton = screen.getByText('Continue');
      expect(continueButton).toBeInTheDocument();
    });
  });

  describe('Multiple Milestones', () => {
    it('should render correctly for all milestone counts', () => {
      const milestones: Array<10 | 25 | 50> = [10, 25, 50];

      milestones.forEach((count) => {
        const { unmount } = render(<MilestoneScreen milestoneCount={count} onContinue={mockOnContinue} />);

        expect(screen.getByText(`You've created ${count} GIFs!`)).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('All Callbacks', () => {
    it('should handle all callbacks provided', () => {
      render(
        <MilestoneScreen
          milestoneCount={10}
          onContinue={mockOnContinue}
          onRate={mockOnRate}
          onShare={mockOnShare}
          onGitHub={mockOnGitHub}
        />
      );

      const rateButton = screen.getByText('Rate YTGify').closest('button');
      const shareButton = screen.getByText('Share on X').closest('button');
      const githubButton = screen.getByText('Star on GitHub').closest('button');
      const continueButton = screen.getByText('Continue').closest('button');

      fireEvent.click(rateButton!);
      expect(mockOnRate).toHaveBeenCalledTimes(1);

      fireEvent.click(shareButton!);
      expect(mockOnShare).toHaveBeenCalledTimes(1);

      fireEvent.click(githubButton!);
      expect(mockOnGitHub).toHaveBeenCalledTimes(1);

      fireEvent.click(continueButton!);
      expect(mockOnContinue).toHaveBeenCalledTimes(1);
    });

    it('should handle sequential button clicks', () => {
      render(
        <MilestoneScreen
          milestoneCount={10}
          onContinue={mockOnContinue}
          onRate={mockOnRate}
        />
      );

      const rateButton = screen.getByText('Rate YTGify').closest('button');

      fireEvent.click(rateButton!);
      fireEvent.click(rateButton!);
      fireEvent.click(rateButton!);

      expect(mockOnRate).toHaveBeenCalledTimes(3);
      expect(links.openExternalLink).toHaveBeenCalledTimes(3);
    });
  });

  describe('CSS Classes', () => {
    it('should apply correct CSS classes', () => {
      const { container } = render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      expect(container.querySelector('.ytgif-wizard-screen')).toBeInTheDocument();
      expect(container.querySelector('.ytgif-milestone-screen')).toBeInTheDocument();
      expect(container.querySelector('.ytgif-wizard-header')).toBeInTheDocument();
      expect(container.querySelector('.ytgif-wizard-content')).toBeInTheDocument();
    });

    it('should apply milestone-specific classes', () => {
      const { container } = render(<MilestoneScreen milestoneCount={10} onContinue={mockOnContinue} />);

      expect(container.querySelector('.ytgif-milestone-icon')).toBeInTheDocument();
      expect(container.querySelector('.ytgif-milestone-message')).toBeInTheDocument();
      expect(container.querySelector('.ytgif-milestone-actions')).toBeInTheDocument();
      expect(container.querySelector('.ytgif-milestone-continue')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should complete full milestone workflow', () => {
      render(
        <MilestoneScreen
          milestoneCount={25}
          onContinue={mockOnContinue}
          onRate={mockOnRate}
          onShare={mockOnShare}
          onGitHub={mockOnGitHub}
        />
      );

      // Verify milestone title
      expect(screen.getByText('Amazing Work!')).toBeInTheDocument();

      // User rates
      const rateButton = screen.getByText('Rate YTGify').closest('button');
      fireEvent.click(rateButton!);
      expect(mockOnRate).toHaveBeenCalled();

      // User shares
      const shareButton = screen.getByText('Share on X').closest('button');
      fireEvent.click(shareButton!);
      expect(mockOnShare).toHaveBeenCalled();

      // User stars on GitHub
      const githubButton = screen.getByText('Star on GitHub').closest('button');
      fireEvent.click(githubButton!);
      expect(mockOnGitHub).toHaveBeenCalled();

      // User continues
      const continueButton = screen.getByText('Continue').closest('button');
      fireEvent.click(continueButton!);
      expect(mockOnContinue).toHaveBeenCalled();
    });
  });
});
