import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Event } from "nostr-tools";
import {
  getKeyFromTags,
  getReceivedMessages,
  getSentMessages,
  groupChatEvents,
} from "components/apps/Messenger/functions";
import type { ChatEvents } from "components/apps/Messenger/types";
import { useNostrEvents } from "nostr-react";

type MessageData = {
  allEventsReceived: boolean;
  messages: ChatEvents;
};

type MessagesState = {
  events: Event[];
  outgoingEvents: Event[];
  publicKey: string;
  sendingEvent: (event: Event) => void;
};

const MessageContext = createContext({
  events: [],
  outgoingEvents: [],
  publicKey: "",
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  sendingEvent: () => {},
} as MessagesState);

export const useMessageContext = (): MessagesState =>
  useContext(MessageContext);

export const useMessages = (recipientPublicKey: string): MessageData => {
  const { events, publicKey, outgoingEvents } = useMessageContext();

  return {
    allEventsReceived: useMemo(
      () =>
        !outgoingEvents.some(
          ({ tags }) => getKeyFromTags(tags) === recipientPublicKey
        ),
      [outgoingEvents, recipientPublicKey]
    ),
    messages: useMemo(
      () =>
        groupChatEvents(
          events.filter(({ pubkey, tags }) => {
            const isSender = pubkey === recipientPublicKey;
            const isRecipient = getKeyFromTags(tags) === recipientPublicKey;

            return recipientPublicKey === publicKey
              ? isSender && isRecipient
              : isSender || isRecipient;
          })
        ),
      [events, publicKey, recipientPublicKey]
    ),
  };
};

type MessageProviderProps = {
  publicKey: string;
};

export const MessageProvider = memo<FC<MessageProviderProps>>(
  ({ children, publicKey }) => {
    const receivedEvents = useNostrEvents(getReceivedMessages(publicKey));
    const sentEvents = useNostrEvents(getSentMessages(publicKey));
    const [outgoingEvents, setOutgoingEvents] = useState<Event[]>([]);
    const sendingEvent = useCallback(
      (event: Event) =>
        setOutgoingEvents((currentOutgoingEvents) => [
          ...currentOutgoingEvents,
          event,
        ]),
      []
    );
    const chatEvents = useMemo(
      () => [...receivedEvents.events, ...sentEvents.events],
      [receivedEvents.events, sentEvents.events]
    );
    const events = useMemo(
      () => [
        ...chatEvents,
        ...outgoingEvents.filter(
          (event) => !sentEvents.events.some(({ id }) => id === event.id)
        ),
      ],
      [chatEvents, outgoingEvents, sentEvents.events]
    );

    useEffect(() => {
      outgoingEvents.forEach((message) => {
        if (chatEvents.some(({ id }) => id === message.id)) {
          setOutgoingEvents((currentOutgoingEvents) =>
            currentOutgoingEvents.filter(({ id }) => id !== message.id)
          );
        }
      });
    }, [chatEvents, outgoingEvents]);

    return (
      <MessageContext.Provider
        value={useMemo(
          () => ({
            events,
            outgoingEvents,
            publicKey,
            sendingEvent,
          }),
          [events, outgoingEvents, publicKey, sendingEvent]
        )}
      >
        {children}
      </MessageContext.Provider>
    );
  }
);
