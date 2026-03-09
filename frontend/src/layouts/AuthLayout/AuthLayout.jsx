import { Outlet } from 'react-router-dom'
import AmbientParticles from '../../components/Effects/AmbientParticles/AmbientParticles';

function AuthLayout() {
    return (
        <div>
            <AmbientParticles />
            <Outlet />
        </div>
    )
}

export default AuthLayout;