import Image from "next/image";
import React from "react";
import profileCharacter from "../../../public/character.png";

const AboutCoverSection = () => {
  return (
    <section className="w-full md:h-[75vh] border-b-2 border-solid border-dark dark:border-light flex flex-col md:flex-row items-center justify-center text-dark dark:text-light">
      <div className="w-full md:w-1/2 h-full border-r-2 border-solid border-dark dark:border-light flex justify-center">
        <Image
          src={profileCharacter}
          alt="After The Silence"
          className="w-full xs:w-2/3 sm:w-3/4 md:w-2/3 lg:w-1/2 xl:w-1/3 h-auto object-contain object-center"
          priority
          sizes="(max-width: 768px) 100vw,(max-width: 1180px) 50vw, 50vw"
        />
      </div>

      <div className="w-full md:w-1/2 flex flex-col text-left items-start justify-center px-5 xs:p-10 pb-10 lg:px-16">
        <h2 className="font-bold capitalize text-4xl xs:text-5xl sxl:text-6xl text-center lg:text-left">
          No Longer Silent
        </h2>

        <p className="font-medium mt-4 text-base">
          This is a blog created for queer people in India to find relevant,
          accessible information about social, medical, and legal transitioning.
          It exists as a resource for those trying to navigate complex systems;
          both socially, legally, and medically. Alongside practical guides, this
          blog also features writing on social issues affecting the queer
          community in India, with a focus on lived experiences, systemic
          barriers, and the realities that are often ignored or oversimplified.{" "}
          <span className="whitespace-nowrap">
            Contact me at{" "}
            <a
              href="mailto:vismaya@afterthesilence.org"
              className="underline underline-offset-4 hover:opacity-80"
            >
              vismaya@afterthesilence.org
            </a>
            .
          </span>
        </p>
      </div>
    </section>
  );
};

export default AboutCoverSection;