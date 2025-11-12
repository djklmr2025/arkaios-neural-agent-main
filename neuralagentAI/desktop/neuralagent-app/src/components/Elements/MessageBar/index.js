import React from 'react';
import { MessageBarContainer } from './MessageBarElements';

const MessageBar = ({ message, backgroundColor }) => {
  return (
    // Use transient prop so it isn't forwarded to the DOM element
    <MessageBarContainer $backgroundColor={backgroundColor}>
      <p style={{textAlign: 'center'}}>
        {message}
      </p>
    </MessageBarContainer>
  )
}

export default MessageBar;
