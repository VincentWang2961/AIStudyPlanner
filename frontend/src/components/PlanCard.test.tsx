import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanCard from './PlanCard';

const planCardProps = {
  name: 'Master of Information Technology Plan',
  program: 'Master of Information Technology',
  semesters: 4,
  unitsCompleted: 15,
  totalUnits: 15,
  createdDate: '26 May 2026',
};

describe('PlanCard', () => {
  it('selects when visible card content is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();

    render(<PlanCard {...planCardProps} onClick={handleClick} />);

    await user.click(screen.getByText('Master of Information Technology Plan'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('selects from the keyboard', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();

    render(<PlanCard {...planCardProps} onClick={handleClick} />);

    const card = screen.getByRole('button', { name: 'Select Master of Information Technology Plan' });
    card.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
