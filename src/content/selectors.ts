// All YouTube DOM selectors live here so that when YouTube ships a rename,
// we only need to update this one file.

export const SELECTORS = {
  // Container that holds the scrolling list of messages.
  messageList: 'yt-live-chat-item-list-renderer #items',

  // Individual rendered message (the one we tokenize into).
  textMessageRenderer: 'yt-live-chat-text-message-renderer',

  // Body of a message where the text lives.
  messageBody: '#message',

  // Paid / super-chat messages have their own renderer — skip them in v1.
  paidMessageRenderer: 'yt-live-chat-paid-message-renderer',

  // Chat input (contenteditable div).
  chatInput: '#input.yt-live-chat-text-input-field-renderer',

  // Message input renderer that wraps the input + send button + emoji button.
  messageInputRenderer: 'yt-live-chat-message-input-renderer',

  // The <div id="buttons"> container next to the input we can append our picker button to.
  inputButtonsContainer: '#buttons',
} as const;
