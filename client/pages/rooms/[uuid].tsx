import { Button, Flex, Heading, Input, Select, Stack, Tab, TabList, Tabs, Text } from "@chakra-ui/react";
import Editor, { useMonaco } from "@monaco-editor/react";
import monaco from 'monaco-editor';
import Router from "next/router"
import { useEffect, useRef, useState } from "react";
import NavBar from "../../components/navBar";
import { SERVER_URL } from "../../constants";

interface WebSocketMessage {
    event: string, // userJoined, userLeft, message, error 
    message?: string // Only appears on error and message events
    username?: string // Only appears on userJoin, userLeft and message events
    code?: string // Only appears on code events
    language?: string // Only appears on code events
}

interface UserData {
    username: string,
    code: string,
    language: string,
}

export default function Room() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [messages, setMessages] = useState<string[]>(["Welcome to the room!", "This is a test message!"]);
    const [websocket, setWebSocket] = useState<WebSocket | null>(null);
    const [currentLanguage, setCurrentLanguage] = useState<string>("javascript");
    // TOOD: not sure if this needs to use state or not...
    const [currentCode, setCurrentCode] = useState<string>("");

    // TODO: This might be inefficent as it will cause many state changes
    const [users, setUsers] = useState<UserData[]>(
        [
            {
                username: "test",
                code: "console.log('hello world')",
                language: "javascript",
            },
            {
                username: "test2",
                code: "console.log('hello world 2222222')",
                language: "javascript",
            },
        ]
    );

    const [currentlyViewingUser, setCurrentlyViewingUser] = useState<string | null>(null);

    let hasCodeChanged = false;
    const editor = useMonaco();

    useEffect(() => {
        setInterval(() => {
            sendCurrentCode();
        }, 2 * 1000);
    });

    // useEffect(() => {
    //     const { uuid } = Router.query;
    //     if (!uuid) {
    //         return;
    //     }

    //     // make http request to get the room info 
    //     const roomData = fetch(`${SERVER_URL}/api/v1/rooms/${uuid}`, {
    //         "method": "GET",
    //         "credentials": "include",
    //         "mode": "cors",
    //     }).then(response => response.json());

    //     roomData.then(data => {
    //         console.log(data);
    //         setUsers(data.users);
    //     });
    // }, []);

    // useEffect(() => {
    //     const { uuid } = Router.query;
    //     if (!uuid) {
    //         return;
    //     }

    //     if (!websocket) {
    //         // create new websocket connection
    //         setWebSocket(new WebSocket(`ws://localhost:4000/${uuid}`));
    //     }

    //     if (!websocket) {
    //         return;
    //     }

    //     // websocket event handlers
    //     websocket.onopen = () => {
    //         console.log("connected");
    //     }

    //     websocket.onmessage = (event) => {
    //         processMessage(event.data);
    //     }

    //     websocket.onclose = () => {
    //         Router.push("/rooms");
    //     }

    //     // On component unmount, close websocket
    //     return () => {
    //         websocket.close();
    //     }
    // }, [websocket]);

    function processMessage(rawMessage: string) {
        const message: WebSocketMessage = JSON.parse(rawMessage);
        console.log(message);

        let newMessage: string | undefined;
        switch (message.event) {
            case "userJoined":
                newMessage = `User ${message.username} joined`;
                setUsers(users => ([...users, { username: message.username!, code: "", language: "javascript" }]));
                break;
            case "userLeft":
                newMessage = `User ${message.username} left`;
                setUsers(users => (users.filter(user => user.username !== message.username)));
                break;
            case "error":
                console.error("Error: ", message.message);
                break;
            case "message":
                newMessage = `User ${message.username}: ${message.message}`;
                break;
            case "code":
                // TODO: Update the code in the editor
                setUsers(users => (users.map(user => {
                    if (user.username === message.username) {
                        return {
                            ...user,
                            code: message.code!,
                            language: message.language!,
                        }
                    }
                    return user;
                })));

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

    function sendCurrentCode() {
        // only send code if it has changed 
        if (!hasCodeChanged) return;

        hasCodeChanged = false;

        if (!websocket) {
            console.log("No websocket connection");
            return;
        }

        const message = {
            event: "code",
            code: currentCode,
            language: currentLanguage
        }

        websocket.send(JSON.stringify(message));
    }

    function handleEditorChange(value: string | undefined, event: monaco.editor.IModelContentChangedEvent) {
        if (!value) return;
        hasCodeChanged = true;
        setCurrentCode(value);
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
                                    {
                                        users.map((user, index) => {
                                            return <Tab key={index} onClick={() => {
                                                setCurrentlyViewingUser(user.username);
                                            }}> {user.username} </Tab>
                                        })
                                    }
                                </TabList>
                            </Tabs>
                            <Editor
                                theme="vs-dark"
                                width="100%"
                                height="83.5vh"
                                language={currentLanguage}
                                defaultValue=""
                                onChange={handleEditorChange}
                            />

                            <Flex direction="row" justifyContent="flex-end" mt={2} padding={2} onChange={
                                // TODO: Figure out how to get the value of the select
                                (e) => {
                                    console.log(e.target.value);
                                    setCurrentLanguage(e.target.value);
                                }
                            }>
                                <Select size="sm" placeholder={currentLanguage}>
                                    <option value="javascript">JavaScript</option>
                                    <option value="typescript">TypeScript</option>
                                    <option value="java">Java</option>
                                    <option value="cpp">C++</option>
                                </Select>
                                <Button size="sm" ml={2}> Submit </Button>
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
            </Flex>
        </>
    )
}
