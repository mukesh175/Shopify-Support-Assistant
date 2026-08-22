/**
 * Starter answers offered to a shop with an empty knowledge base.
 *
 * Every specific is a [placeholder]: a merchant who saves these unedited would
 * otherwise have the assistant quote invented policies to their customers.
 * Blanks are obvious and get fixed; a plausible wrong number does not.
 *
 * Ordered by how often shoppers actually ask, so a shop on a plan that caps
 * entries gets the most useful ones.
 */
export const STARTERS: Array<{ question: string; answer: string }> = [
  {
    question: 'What is your return policy?',
    answer:
      'You can return items within [number] days of delivery, as long as they are unused and in the original packaging. [Add any exceptions, for example sale items or innerwear.] Contact us and we will guide you through it.',
  },
  {
    question: 'How long does delivery take?',
    answer:
      'Orders are dispatched within [1-2] business days. Delivery usually takes [3-5] business days to [regions you cover]. You will get a tracking link by email once your order ships.',
  },
  {
    question: 'How do I track my order?',
    answer:
      'Ask me here with your order number and the email you used at checkout, and I will look it up. You will also find a tracking link in your shipping confirmation email.',
  },
  {
    question: 'Do you offer cash on delivery?',
    answer:
      '[Yes / No.] [If yes, note any extra charge or pin codes where it is unavailable.]',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept [UPI, cards, net banking, wallets]. [Mention anything you do not accept.] All payments are processed securely by Shopify.',
  },
  {
    question: 'Can I exchange an item for a different size?',
    answer:
      'Yes — exchanges are available within [number] days, subject to stock. [Explain whether the customer pays return shipping.] Start by telling me your order number.',
  },
  {
    question: 'Do you ship internationally?',
    answer:
      '[Yes, we ship to (countries) / No, we currently ship within (country) only.] [If yes, note delivery times and who covers customs duties.]',
  },
];
