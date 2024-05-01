import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
} from '@chakra-ui/react'

// TODO: Fix any and return type for NavBar
export default function NavBar(props: any) {
    const navLinks = [
        {
            name: "Rooms",
            href: "/rooms",
        },
        {
            name: "Login",
            href: "/login",
        },
        {
            name: "Logout",
            href: "/logout",
        }
    ]

    return (
        <Breadcrumb padding={5} paddingBottom={0} separator='-' color="gray.400">
            {navLinks.map((link) => (
                <BreadcrumbItem key={link.name}>
                    <BreadcrumbLink href={link.href}>{link.name}</BreadcrumbLink>
                </BreadcrumbItem>
            ))}

            {props.children}
        </Breadcrumb>
    );
}