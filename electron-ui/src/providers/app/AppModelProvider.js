import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useEffect, useState } from 'react';
export const AppModelContext = createContext(null);
export function AppModelProvider({ children, appModel }) {
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        if (appModel) {
            setIsReady(true);
        }
    }, [appModel]);
    return (_jsx(AppModelContext.Provider, { value: { appModel, isReady }, children: children }));
}
