import Login from "./components/auth/login";
import Register from "./components/auth/register";
import { useRoutes, Navigate } from "react-router-dom";
import Header from "./components/header";
import Home from "./components/home";

import { AuthProvider, useAuth } from "./contexts/authContext";
import { MachineConfigProvider } from "./contexts/machineConfigContext";

const PrivateRoute = ({ children }) => {
  const { userLoggedIn } = useAuth();
  return userLoggedIn ? children : <Navigate to="/login" replace />;
};

function App() {
  const routesArray = [
    {
      path: "*",
      element: <Login />,
    },
    {
      path: "/login",
      element: <Login />,
    },
    {
      path: "/register",
      element: <Register />,
    },
    {
      path: "/home",
      element: (
        <PrivateRoute>
          <Home />
        </PrivateRoute>
      ),
    },
  ];
  let routesElement = useRoutes(routesArray);
  return (
    <AuthProvider>
      <MachineConfigProvider>
        <Header />
        <div className="w-full h-screen flex flex-col">{routesElement}</div>
      </MachineConfigProvider>
    </AuthProvider>
  );
}

export default App;
