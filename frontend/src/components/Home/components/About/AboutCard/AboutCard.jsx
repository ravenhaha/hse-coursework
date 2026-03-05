function AboutCard(props) {
    const {
        className,
        text,
        numbercard,
        title,
    } = props;

    return (
        <div className={className}>
            <span>{numbercard}</span>
            <h4>{title}</h4>
            <p>{text}</p>
        </div>
    )
}

export default AboutCard;