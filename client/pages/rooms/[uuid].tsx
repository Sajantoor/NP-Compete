import { Button, Flex, Heading, Input, Select, Stack, Tab, TabList, Tabs, Text } from "@chakra-ui/react";
import Editor from "@monaco-editor/react";
import Router from "next/router"
import { useEffect, useRef, useState } from "react";
import NavBar from "../../components/navBar";

interface WebSocketMessage {
    event: string, // userJoined, userLeft, message, error 
    message?: string // Only appears on error and message events
    username?: string // Only appears on userJoin, userLeft and message events
}


export default function Room() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [messages, setMessages] = useState<string[]>(["Welcome to the room!", "This is a test message!"]);
    const [websocket, setWebSocket] = useState<WebSocket | null>(null);
    const [currentLanguage, setCurrentLanguage] = useState<string>("JavaScript");

    useEffect(() => {
        const { uuid } = Router.query;
        if (!uuid) {
            return;
        }

        if (!websocket) {
            // create new websocket connection
            setWebSocket(new WebSocket(`ws://localhost:4000/${uuid}`));
        }

        if (!websocket) {
            return;
        }

        // websocket event handlers
        websocket.onopen = () => {
            console.log("connected");
        }

        websocket.onmessage = (event) => {
            processMessage(event.data);
        }

        websocket.onclose = () => {
            Router.push("/rooms");
        }

        // On component unmount, close websocket
        return () => {
            websocket.close();
        }
    }, [websocket]);

    function processMessage(rawMessage: string) {
        const message: WebSocketMessage = JSON.parse(rawMessage);
        console.log(message);

        let newMessage: string | undefined;
        switch (message.event) {

            case "userJoined":
                newMessage = `User ${message.username} joined`;
                break;
            case "userLeft":
                newMessage = `User ${message.username} left`;
                break;
            case "error":
                console.error("Error: ", message.message);
                break;
            case "message":
                newMessage = `User ${message.username}: ${message.message}`;
                break;
            default:
                console.error("Unknown event: ", message.event);
                break;
        }

        if (newMessage) {
            // TODO: I'm not sure why this has to be a function
            setMessages(messages => ([...messages, newMessage!]));
        }
    }

    function sendMessage() {
        const message = inputRef?.current?.value;
        if (!message) {
            return;
        }

        if (!websocket) {
            console.log("No websocket connection");
            return;
        }

        websocket.send(message);
    }

    return (
        <>
            <NavBar>
                <Heading fontSize="xl"> Room Name Here </Heading>
            </NavBar>

            <Flex direction="column" padding={5}>
                <Flex direction="row" mb={2}>
                </Flex>

                <Flex direction="row" mb={2}>
                    <Flex direction="row" minWidth="100%" height="100%">
                        <Flex bg="gray.800" p={5} direction="column" width="25%">
                            <Heading fontSize="xl" mb={5}> Two Sum </Heading>
                            <Text>
                                Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

                                You may assume that each input would have exactly one solution, and you may not use the same element twice.

                                You can return the answer in any order.

                                Example 1:

                                Input: nums = [2,7,11,15], target = 9
                                Output: [0,1]

                                Constraints:


                                Follow-up: Can you come up with an algorithm that is less than O(n^2) time complexity
                            </Text>
                        </Flex>

                        <Flex bg="gray.800" p={5} direction="column" width="70%" padding={0}>
                            <Tabs variant='soft-rounded' mb={2}>
                                <TabList>
                                    <Tab>User 1</Tab>
                                    <Tab>User 2</Tab>
                                </TabList>
                            </Tabs>
                            <Editor
                                theme="vs-dark"
                                width="100%"
                                height="83.5vh"
                                defaultLanguage="javascript"
                                defaultValue=""
                            />

                            <Flex direction="row" justifyContent="flex-end" mt={2} padding={2}>
                                <Select size='sm' placeholder={currentLanguage} >
                                    <option value='option2'>Java</option>
                                    <option value='option3'>C++</option>
                                </Select>
                                <Button size='sm' ml={2}> Submit </Button>

                            </Flex>
                        </Flex>

                        <Flex bg="gray.800" p={5} direction="column" width="25%" alignSelf="flex-end">
                            <Heading fontSize="2xl" mb={5}> Messages </Heading>
                            <Flex direction="column" minHeight="70vh" justifyContent="flex-end" mb={2}>
                                <Stack mb={5}>
                                    {messages.map((message, index) => {
                                        return (
                                            <Text key={index}> {message} </Text>
                                        )
                                    })}
                                </Stack>

                                {/* move this flex to the bottom of the page */}
                                <Flex direction="row" >
                                    <Input mr={2} ref={inputRef} type="text" size="sm" />
                                    <Button onClick={sendMessage} size="sm"> Send </Button>
                                </Flex>
                            </Flex>
                        </Flex>
                    </Flex>
                </Flex>

            </Flex >
        </>
    )
}
