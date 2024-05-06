import { Stack, Button, Link } from "@chakra-ui/react";
import { cookies } from "next/headers";

export default function NavBar(props: any) {
    const navLinks = [
        {
            name: "Rooms",
            href: "/rooms",
        },
    ];

    const loginLink = {
        name: "Login",
        href: "/login",
    };

    const logoutLink = {
        name: "Logout",
        href: "/logout",
    };

    const cookie = cookies().get("qid");

    const isLoggedIn = validateCookie();

    function validateCookie() {
        if (cookie === undefined || cookie.value === "") {
            return false;
        }

        // TODO: Check with the server if the session is still valid...

        return true;
    }

    return (
        <>
            <Stack direction="row" spacing={4} padding={5}>
                {navLinks.map((link) => (
                    <Link key={link.name} href={link.href}>
                        <Button>{link.name}</Button>
                    </Link>
                ))}

                {/* move logout button to the right */}
                <Link href={isLoggedIn ? logoutLink.href : loginLink.href}>
                    <Button>
                        {isLoggedIn ? logoutLink.name : loginLink.name}
                    </Button>
                </Link>
            </Stack>
            {props.children}
        </>
    );
}
