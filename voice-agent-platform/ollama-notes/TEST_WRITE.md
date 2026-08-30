# Fail-Closed Adapter Pattern

The **Fail-Closed Adapter Pattern** is a design pattern used in software development where an adapter class wraps another class and provides a consistent interface to it. This pattern ensures that if the wrapped object fails, the adapter can handle the failure gracefully without crashing or throwing exceptions.

In this pattern, the adapter acts as a mediator between the client and the underlying system. It intercepts requests from the client and handles them before passing them on to the wrapped object. If the wrapped object fails, the adapter can log the error, retry the operation, or provide a default value instead of crashing.

This approach is particularly useful in scenarios where the reliability of the underlying system is critical, such as in network communication, database access, or file operations. By using a fail-closed adapter, developers can ensure that their applications remain robust and functional even when encountering issues with external systems.